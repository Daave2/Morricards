

'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useAudioFeedback } from '@/hooks/use-audio-feedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, PackageSearch, ScanLine, X, Check, Info, Undo2, Trash2, Link as LinkIcon, CameraOff, Zap, Share2, Copy, Settings, WifiOff, Wifi, RefreshCw, Bolt, Bot, Map, ScanSearch, AlertTriangle, ChevronsUpDown, DownloadCloud, ArrowLeft, User, ListOrdered, CheckCheck, MoreVertical, Phone, Eye, PackageCheck, Upload, CalendarClock, Hash, ChevronDown, Replace, PoundSterling, MapPin, Expand, PackageX, Archive, ArchiveRestore, Mail, MessageSquare, FileDown } from 'lucide-react';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from '@/lib/utils';
import ZXingScanner from '@/components/ZXingScanner';
import { useApiSettings } from '@/hooks/use-api-settings';
import { useNetworkSync } from '@/hooks/useNetworkSync';
import InstallPrompt from '@/components/InstallPrompt';
import { queueProductFetch } from '@/lib/offlineQueue';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProductCard from '@/components/product-card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import SearchComponent from '@/components/assistant/Search';
import type { SearchHit } from '@/lib/morrisonsSearch';
import ImageModal from '@/components/image-modal';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCollection, useFirestore, useMemoFirebase } from '@/src/firebase';
import { setDocumentNonBlocking } from '@/src/firebase/non-blocking-updates';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';


// TYPES
type Product = FetchMorrisonsDataOutput[0];

interface PickedItem {
    sku: string;
    isSubstitute: boolean;
    details?: Product | null;
}

interface OrderProduct {
    sku: string;
    name: string;
    quantity: number;
    pickedItems: PickedItem[];
    details?: Product | null;
}

interface Order {
    id: string;
    customerName: string;
    collectionSlot: string;
    phoneNumber: string | null;
    products: OrderProduct[];
    isPicked: boolean;
    isArchived: boolean;
}

// State is now nested: { "25-11-2025": { "16:00 - 17:00": [Order, ...] } }
type GroupedOrders = Record<string, Record<string, Order[]>>;


const FormSchema = z.object({
  rawOrderText: z.string().min(10, 'Please paste in the order text.'),
});


const parseOrderText = (text: string): Order[] => {
    const orders: Order[] = [];
    const orderSections = text.split(/(?=COLLECTION POINT OPERATIONS\nBACK\nOrder for)/).filter(s => s.trim() !== '');

    orderSections.forEach((section, index) => {
        const orderRefMatch = section.match(/Order reference: (\d+)/);
        const customerNameMatch = section.match(/Order for (.*?)\n/);
        const collectionSlotMatch = section.match(/Collection slot: (.*?)\n/);
        const phoneMatch = section.match(/Phone number: ([+0-9\s]+)/);

        if (!customerNameMatch) return;
        
        const orderContentsSplit = section.split('Order contents');
        if (orderContentsSplit.length < 2) return;
        
        const productsSection = orderContentsSplit[1];
        
        const productLines = productsSection.split('\n').filter(l => /^\d{7,}/.test(l.trim()));
        
        const productMap = new window.Map<string, { name: string; quantity: number }>();

        productLines.forEach(line => {
            const parts = line.trim().split('\t');
            if (parts.length >= 2) {
                const sku = parts[0].trim();
                const name = parts[1].trim();
                if (productMap.has(sku)) {
                    productMap.get(sku)!.quantity++;
                } else {
                    productMap.set(sku, { name, quantity: 1 });
                }
            }
        });
        
        // Use the official Order Reference as the ID. Fallback to a generated one if not found.
        const id = orderRefMatch ? orderRefMatch[1] : `manual-${customerNameMatch[1].trim()}-${collectionSlotMatch ? collectionSlotMatch[1].trim() : Date.now() + index}`;

        if (productMap.size > 0) {
            orders.push({
                id,
                customerName: customerNameMatch[1].trim(),
                collectionSlot: collectionSlotMatch ? collectionSlotMatch[1].trim() : 'N/A',
                phoneNumber: phoneMatch ? phoneMatch[1].trim() : null,
                products: Array.from(productMap.entries()).map(([sku, { name, quantity }]) => ({
                    sku,
                    name,
                    quantity,
                    pickedItems: [],
                })),
                isPicked: false,
                isArchived: false,
            });
        }
    });

    return orders;
};

const OrderSummary = ({ order, onShowDetails }: { order: Order, onShowDetails: (order: Order, title: string, products: OrderProduct[]) => void }) => {
    
    const pickedProducts = order.products.filter(p => p.pickedItems.some(i => !i.isSubstitute));
    const subbedProducts = order.products.filter(p => p.pickedItems.some(i => i.isSubstitute && i.sku !== 'MISSING'));
    const missingProducts = order.products.filter(p => p.pickedItems.some(i => i.sku === 'MISSING'));
    
    const stats = [
        { label: 'Picked', count: pickedProducts.length, icon: <Check className="h-4 w-4 text-green-600"/>, products: pickedProducts },
        { label: 'Subbed', count: subbedProducts.length, icon: <Replace className="h-4 w-4 text-blue-600"/>, products: subbedProducts },
        { label: 'Missing', count: missingProducts.length, icon: <PackageX className="h-4 w-4 text-red-600"/>, products: missingProducts },
    ];

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2">
            {stats.map(stat => (
                stat.count > 0 ? (
                    <div 
                        key={stat.label} 
                        className="flex items-center gap-1.5 cursor-pointer hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); onShowDetails(order, stat.label, stat.products); }}
                    >
                        {stat.icon} {stat.label}: <span className="font-bold">{stat.count}</span>
                    </div>
                ) : null
            ))}
        </div>
    )
}


export default function PickingListClient() {
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [viewOrder, setViewOrder] = useState<Order | null>(null); // For read-only view
  const [isLoading, setIsLoading] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [sortConfig, setSortConfig] = useState<string>('walkSequence-asc');
  const [isCompletionAlertOpen, setIsCompletionAlertOpen] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [substitutingFor, setSubstitutingFor] = useState<OrderProduct | null>(null);
  const [substituteDialogOpen, setSubstituteDialogOpen] = useState(false);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [summaryDialogContent, setSummaryDialogContent] = useState<{order: Order | null, title: string, products: OrderProduct[]}>({order: null, title: '', products: []});
  const [isSpeedMode, setIsSpeedMode] = useState(false);


  const { toast } = useToast();
  const { playSuccess, playError, playInfo } = useAudioFeedback();
  const { settings } = useApiSettings();
  const { isOnline } = useNetworkSync();
  const scannerRef = useRef<{ start: () => void; stop: () => void; getOcrDataUri: () => string | null; } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firestore = useFirestore();
  const ordersCollectionRef = useMemoFirebase(
    () => settings.locationId ? collection(firestore, `stores/${settings.locationId}/pickingOrders`) : null,
    [firestore, settings.locationId]
  );
  
  const { data: ordersFromDb, isLoading: isDbLoading } = useCollection<Order>(ordersCollectionRef);

  const startScannerWithDelay = useCallback(() => {
    setTimeout(() => {
        if (scannerRef.current) {
            scannerRef.current.start();
        }
    }, 1500); // 1.5 second delay
  }, []);
  
  useEffect(() => {
    if (isScannerActive) {
      scannerRef.current?.start();
    } else {
      scannerRef.current?.stop();
    }
  }, [isScannerActive]);
  
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { rawOrderText: '' },
  });
  
  const parseSlot = (slot: string): [Date, string, string] => {
      const defaultDate = new Date(0);
      try {
        const dateMatch = slot.match(/(\d{2}-\d{2}-\d{4})/);
        const timeMatch = slot.match(/(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})/);

        if (dateMatch && timeMatch) {
            const [day, month, year] = dateMatch[0].split('-').map(Number);
            const [startTime] = timeMatch[0].split(/\s*-\s*/);
            const date = new Date(year, month - 1, day, parseInt(startTime.split(':')[0]), parseInt(startTime.split(':')[1]));
             if (!isNaN(date.getTime())) {
              return [date, dateMatch[0], timeMatch[0]];
            }
        }
      } catch (e) {
      }
      return [defaultDate, "Unsorted", "N/A"];
  };

  const filteredOrdersFromDb = useMemo(() => {
    if (!ordersFromDb) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return ordersFromDb.filter(order => {
        if (order.isArchived) {
            return true;
        }
        
        const [orderDate] = parseSlot(order.collectionSlot);
        
        if (orderDate.getTime() === new Date(0).getTime()) {
            return true;
        }
        
        orderDate.setHours(0, 0, 0, 0);
        return orderDate >= today;
    });
  }, [ordersFromDb]);


  const handleImportOrders = async (values: z.infer<typeof FormSchema>) => {
    setIsLoading(true);
    const { id: toastId, update } = toast({ title: 'Parsing orders...', description: 'Please wait.' });

    const parsedOrders = parseOrderText(values.rawOrderText);

    if (parsedOrders.length === 0) {
        playError();
        update({ id: toastId, variant: 'destructive', title: 'Import Failed', description: 'Could not find any valid orders in the text.' });
        setIsLoading(false);
        return;
    }

    if (!settings.locationId || !firestore) {
        playError();
        update({ id: toastId, variant: 'destructive', title: 'Import Failed', description: 'Store Location ID is not set or Firestore is not available.' });
        setIsLoading(false);
        return;
    }

    let importedCount = 0;
    let updatedCount = 0;

    const BATCH_SIZE = 5; 

    for (let i = 0; i < parsedOrders.length; i += BATCH_SIZE) {
        const batch = parsedOrders.slice(i, i + BATCH_SIZE);
        const progress = i + batch.length;

        update({ id: toastId, title: 'Importing Orders...', description: `Processing ${progress} of ${parsedOrders.length}...` });

        const skusInBatch = new Set<string>();
        batch.forEach(order => order.products.forEach(p => skusInBatch.add(p.sku)));

        const { data: productDetails, error } = await getProductData({
            locationId: settings.locationId,
            skus: Array.from(skusInBatch),
            bearerToken: settings.bearerToken,
            debugMode: settings.debugMode,
        });

        if (error) {
            update({ id: toastId, variant: 'destructive', title: `Product Fetch Error (Batch ${i/BATCH_SIZE + 1})`, description: error });
            continue;
        }

        const productMap = new window.Map<string, Product>();
        if (productDetails) {
            productDetails.forEach(p => productMap.set(p.sku, p));
        }
    
        const enrichedOrders = batch.map(order => ({
            ...order,
            products: order.products.map(p => ({ 
                ...p, 
                details: productMap.get(p.sku) || null
            })),
        }));

        try {
            const firestoreBatch = writeBatch(firestore);
            const existingOrderIds = new Set(ordersFromDb?.map(o => o.id));

            enrichedOrders.forEach(orderData => {
                const orderRef = doc(firestore, `stores/${settings.locationId}/pickingOrders`, orderData.id);
                firestoreBatch.set(orderRef, orderData, { merge: true });
                if (existingOrderIds.has(orderData.id)) {
                    updatedCount++;
                } else {
                    importedCount++;
                }
            });
            await firestoreBatch.commit();
        } catch (e) {
            const batchError = e instanceof Error ? e.message : String(e);
            update({ id: toastId, variant: 'destructive', title: `Firestore Error (Batch ${i/BATCH_SIZE + 1})`, description: batchError });
            continue; 
        }
        
        await new Promise(resolve => setTimeout(resolve, 200)); 
    }


    update({
        id: toastId,
        title: 'Import Complete',
        description: `Successfully imported ${importedCount} new orders and updated ${updatedCount} existing orders.`
    })

    form.reset();
    setIsLoading(false);
    playSuccess();
  }
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        form.setValue('rawOrderText', text);
        handleImportOrders({ rawOrderText: text });
      };
      reader.onerror = () => {
        toast({ variant: 'destructive', title: 'File Read Error', description: 'Could not read the selected file.' });
      }
      reader.readAsText(file);
    }
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleSelectOrder = (order: Order) => {
    setActiveOrder(order);
    setIsScannerActive(true);
  }
  
  const handleRepickOrder = (orderId: string) => {
     if (!ordersFromDb) return;
     const orderToRepick = ordersFromDb.find(o => o.id === orderId);
     if (!orderToRepick || !settings.locationId) return;

     const resetOrder: Order = {
        ...orderToRepick,
        isPicked: false,
        products: orderToRepick.products.map(p => ({ ...p, pickedItems: [] })),
     };
     
     const orderRef = doc(firestore, `stores/${settings.locationId}/pickingOrders`, orderId);
     setDocumentNonBlocking(orderRef, resetOrder, { merge: true });

     handleSelectOrder(resetOrder);
  }

  const handleToggleOrderArchived = (orderId: string, archive: boolean) => {
    if (!ordersFromDb || !settings.locationId) return;
    const orderToUpdate = ordersFromDb.find(o => o.id === orderId);
    if (!orderToUpdate) return;
     
     const orderRef = doc(firestore, `stores/${settings.locationId}/pickingOrders`, orderId);
     setDocumentNonBlocking(orderRef, { isArchived: archive }, { merge: true });

    toast({ 
        title: `Order ${archive ? 'Archived' : 'Restored'}`, 
        description: `The order has been moved to the ${archive ? 'archived' : 'active'} section.` 
    });
  }

  const handleViewOrder = (order: Order) => {
    setViewOrder(order);
  }
  
  const handleShowSummaryDetails = (order: Order, title: string, products: OrderProduct[]) => {
    setSummaryDialogContent({ order, title, products });
    setSummaryDialogOpen(true);
  };
  
  const handleExportOrder = (order: Order) => {
    let summary = `Order Summary for ${order.customerName}\n`;
    summary += `Order ID: ${order.id}\n`;
    summary += `Collection: ${order.collectionSlot}\n\n`;
    summary += '------------------------------\n\n';

    order.products.forEach(p => {
        summary += `Item: ${p.name} (x${p.quantity})\n`;
        summary += `SKU: ${p.sku}\n`;

        const pickedOriginals = p.pickedItems.filter(item => !item.isSubstitute);
        const substitutes = p.pickedItems.filter(item => item.isSubstitute && item.sku !== 'MISSING');
        const missingCount = p.pickedItems.filter(item => item.sku === 'MISSING').length;
        
        if (pickedOriginals.length === p.quantity) {
            summary += 'Status: Picked\n';
        } else {
            if (pickedOriginals.length > 0) {
                summary += `Picked: ${pickedOriginals.length} of ${p.quantity}\n`;
            }
            if (substitutes.length > 0) {
                substitutes.forEach(sub => {
                    summary += ` -> Substituted with: ${sub.details?.name || 'Unknown'} (SKU: ${sub.sku})\n`;
                });
            }
            if (missingCount > 0) {
                summary += `Status: Missing (${missingCount} unit(s))\n`;
            }
        }
        summary += '\n';
    });

    navigator.clipboard.writeText(summary).then(() => {
        toast({ title: "Order Summary Copied", description: "The order summary has been copied to your clipboard." });
    }).catch(err => {
        toast({ variant: 'destructive', title: "Copy Failed", description: "Could not copy the summary to the clipboard." });
        console.error('Copy failed', err);
    });
  };


  const updateActiveOrderAndDB = (updatedOrder: Order) => {
     if (!settings.locationId) return;
     setActiveOrder(updatedOrder);
     const orderRef = doc(firestore, `stores/${settings.locationId}/pickingOrders`, updatedOrder.id);
     setDocumentNonBlocking(orderRef, updatedOrder, { merge: true });
  };

  const handleScanToPick = useCallback((text: string) => {
    const sku = text.split(',')[0].trim();
    if (!activeOrder || !sku) return;

    const productIndex = activeOrder.products.findIndex(p => p.sku === sku || p.details?.scannedSku === sku || p.details?.primaryEan13 === sku);

    if (productIndex === -1) {
        playError();
        toast({ variant: 'destructive', title: 'Item Not in This Order' });
        if (isSpeedMode) startScannerWithDelay();
        return;
    }
    
    const product = activeOrder.products[productIndex];

    if (product.pickedItems.filter(p => !p.isSubstitute).length >= product.quantity) {
        playInfo();
        toast({ title: 'Already Picked', description: `All units of ${product.name} have been picked.`, icon: <Info /> });
        if (isSpeedMode) startScannerWithDelay();
        return;
    }
    
    playSuccess();
    
    const newProducts = [...activeOrder.products];
    newProducts[productIndex] = {
        ...newProducts[productIndex],
        pickedItems: [...newProducts[productIndex].pickedItems, { sku, isSubstitute: false, details: product.details }]
    };
    
    updateActiveOrderAndDB({ ...activeOrder, products: newProducts });

    toast({ title: 'Item Picked', description: `${product.name} (${newProducts[productIndex].pickedItems.filter(p => !p.isSubstitute).length}/${product.quantity})`, icon: <Check /> });
    
    if (isSpeedMode) startScannerWithDelay();

  }, [activeOrder, playError, playInfo, playSuccess, toast, updateActiveOrderAndDB, isSpeedMode, startScannerWithDelay]);


  const handleManualPick = (sku: string, amount: number) => {
     if (!activeOrder) return;
     
     const productIndex = activeOrder.products.findIndex(p => p.sku === sku);
     if (productIndex === -1) return;

     const product = activeOrder.products[productIndex];
     
     let newPickedItems = [...product.pickedItems];

     if (amount > 0) { // Adding items
        for(let i = 0; i < amount; i++) {
            if (newPickedItems.filter(p => !p.isSubstitute).length < product.quantity) {
                 newPickedItems.push({ sku: product.sku, isSubstitute: false, details: product.details });
            }
        }
     } else { // Removing items
        for(let i = 0; i < Math.abs(amount); i++) {
            const itemIndexToRemove = newPickedItems.findIndex(p => p.sku === product.sku && !p.isSubstitute);
            if (itemIndexToRemove > -1) {
                newPickedItems.splice(itemIndexToRemove, 1);
            }
        }
     }
     
     const newProducts = [...activeOrder.products];
     newProducts[productIndex] = { ...product, pickedItems: newPickedItems };

     updateActiveOrderAndDB({ ...activeOrder, products: newProducts });
  }

  const handleSubstitute = (product: OrderProduct) => {
      setSubstitutingFor(product);
      setSubstituteDialogOpen(true);
  }

  const addSubstituteToOrder = (subProduct: Product) => {
     if (!activeOrder || !substitutingFor) return;

     playSuccess();
    
    const newProducts = activeOrder.products.map(p => {
        if (p.sku === substitutingFor.sku) {
            const newPickedItems: PickedItem[] = [
                ...p.pickedItems, 
                { sku: subProduct.sku, isSubstitute: true, details: subProduct }
            ];
            return { ...p, pickedItems: newPickedItems };
        }
        return p;
    });

    updateActiveOrderAndDB({ ...activeOrder, products: newProducts });

    toast({ title: 'Substitute Added', description: `${subProduct.name} was added as a substitute for ${substitutingFor.name}.` });
    setSubstituteDialogOpen(false);
    setSubstitutingFor(null);
  };

  const handleSubSearchPick = (hit: SearchHit) => {
    if (!hit.retailerProductId) {
       toast({ variant: 'destructive', title: 'Selection Error', description: 'The selected product does not have a valid ID to look up.' });
       return;
    }
    
    toast({ title: 'Substitute Selected', description: `Looking up details for ${hit.title}...` });

    getProductData({
      locationId: settings.locationId,
      skus: [hit.retailerProductId],
      bearerToken: settings.bearerToken,
    }).then(({ data, error }) => {
       if (error || !data || data.length === 0) {
            playError();
            toast({ variant: 'destructive', title: 'Substitute Not Found', description: `Could not find product data for SKU: ${hit.retailerProductId}` });
            return;
       }
       addSubstituteToOrder(data[0]);
    });
  };

  const handleSubScan = async (scannedSku: string) => {
    setIsScannerActive(false);
    
    toast({ title: 'Substitute Scanned', description: `Looking up details for ${scannedSku}...` });

    const { data, error } = await getProductData({
      locationId: settings.locationId,
      skus: [scannedSku],
      bearerToken: settings.bearerToken,
    });

    if (error || !data || data.length === 0) {
      playError();
      toast({ variant: 'destructive', title: 'Substitute Not Found', description: `Could not find product data for SKU: ${scannedSku}` });
      setSubstitutingFor(null);
      setIsScannerActive(true); // Reactivate scanner if scan fails
      return;
    }

    addSubstituteToOrder(data[0]);
  }

  
  const finishOrderCompletion = () => {
    if (!activeOrder) return;
    
    const unpickedProducts = activeOrder.products.filter(p => p.pickedItems.length < p.quantity);

    const productsWithMissingMarked = activeOrder.products.map(p => {
        const pickedCount = p.pickedItems.length;
        if (pickedCount < p.quantity) {
            const missingCount = p.quantity - pickedCount;
            const missingItems: PickedItem[] = Array.from({ length: missingCount }, () => ({ sku: 'MISSING', isSubstitute: true }));
            return { ...p, pickedItems: [...p.pickedItems, ...missingItems] };
        }
        return p;
    });

    const updatedOrder = { 
      ...activeOrder, 
      products: productsWithMissingMarked,
      isPicked: true 
    };

    const { id: toastId, update } = toast({ title: 'Updating Order...', description: 'Please wait.' });
    updateActiveOrderAndDB(updatedOrder);

    setActiveOrder(null);
    setIsScannerActive(false);
    playSuccess();
    update({ id: toastId, title: 'Order Complete!', description: `Order for ${activeOrder.customerName} has been marked as picked. ${unpickedProducts.length > 0 ? `${unpickedProducts.length} item(s) were marked as missing.` : ''}` });
  };
  
  const handleMarkOrderComplete = () => {
    if (!activeOrder) return;

    const unpickedItems = activeOrder.products.filter(p => p.pickedItems.length < p.quantity).length;
    
    if (unpickedItems > 0) {
      setIsCompletionAlertOpen(true);
    } else {
      finishOrderCompletion();
    }
  }

  const groupedOrders = useMemo(() => {
    if (!filteredOrdersFromDb) return {};
    const newGroups: GroupedOrders = {};
    filteredOrdersFromDb.forEach(order => {
        const slot = order.collectionSlot;
        const [, dateKey, timeKey] = parseSlot(slot);

        if (!newGroups[dateKey]) {
            newGroups[dateKey] = {};
        }
        if (!newGroups[dateKey][timeKey]) {
            newGroups[dateKey][timeKey] = [];
        }
        newGroups[dateKey][timeKey].push(order);
    });
    return newGroups;
  }, [filteredOrdersFromDb]);

  const getSortedDateKeys = () => {
      return Object.keys(groupedOrders).sort((a, b) => {
          const dateA = parseSlot(a + ' 00:00 - 00:00')[0];
          const dateB = parseSlot(b + ' 00:00 - 00:00')[0];
          return dateA.getTime() - dateB.getTime();
      });
  };
  
  const getSortedTimeKeys = (dateKey: string) => {
      if (groupedOrders[dateKey]) {
        return Object.keys(groupedOrders[dateKey]).sort((a, b) => {
            if (a === 'N/A') return 1;
            if (b === 'N/A') return -1;
            const timeA = a.split(' - ')[0];
            const timeB = b.split(' - ')[0];
            return timeA.localeCompare(timeB);
        });
      }
      return [];
  }

  const sortedProducts = useMemo(() => {
    if (!activeOrder) return [];
    
    const result: OrderProduct[] = [...activeOrder.products];
    const [key, direction] = sortConfig.split('-');

    result.sort((a, b) => {
        const aIsPicked = a.pickedItems.length >= a.quantity;
        const bIsPicked = b.pickedItems.length >= b.quantity;

        if (aIsPicked && !bIsPicked) return 1;
        if (!aIsPicked && bIsPicked) return -1;
        
        let valA: any;
        let valB: any;

        switch(key) {
            case 'walkSequence':
                valA = a.details?.productDetails?.legacyItemNumbers?.[0] || '999999';
                valB = b.details?.productDetails?.legacyItemNumbers?.[0] || '999999';
                break;
            case 'stock':
                valA = a.details?.stockQuantity ?? -1;
                valB = b.details?.stockQuantity ?? -1;
                break;
            case 'price':
                valA = a.details?.price?.regular ?? -1;
                valB = b.details?.price?.regular ?? -1;
                break;
            case 'name':
                valA = a.name;
                valB = b.name;
                break;
            default:
                return 0;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        
        return direction === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [activeOrder, sortConfig]);

  const groupedAndSortedProducts = useMemo(() => {
    if (!activeOrder) return {};

    const grouped: { [aisle: string]: OrderProduct[] } = {};

    sortedProducts.forEach(product => {
      const aisleMatch = product.details?.location.standard?.match(/Aisle\s*(\d+)/i);
      const aisle = aisleMatch ? `Aisle ${aisleMatch[1]}` : 'Uncategorized';
      if (!grouped[aisle]) {
        grouped[aisle] = [];
      }
      grouped[aisle].push(product);
    });

    return grouped;
  }, [activeOrder, sortedProducts]);

  const aisleKeys = useMemo(() => {
    return Object.keys(groupedAndSortedProducts).sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        const numA = parseInt(a.replace('Aisle ', ''), 10);
        const numB = parseInt(b.replace('Aisle ', ''), 10);
        return numA - numB;
    });
  }, [groupedAndSortedProducts]);


  const unpickedCount = activeOrder?.products.filter(p => p.pickedItems.length < p.quantity).length || 0;
  
  const handleItemToggle = (id: string) => {
    setOpenItemId(prev => prev === id ? null : id);
  }

  const suggestedSubQuery = useMemo(() => {
    if (!substitutingFor) return '';
    return substitutingFor.name.split(' ').slice(0, 2).join(' ');
  }, [substitutingFor]);
  
  const allOrdersList = useMemo(() => filteredOrdersFromDb || [], [filteredOrdersFromDb]);
  const pickedOrders = useMemo(() => allOrdersList.filter(o => o.isPicked && !o.isArchived), [allOrdersList]);
  const archivedOrders = useMemo(() => allOrdersList.filter(o => o.isArchived), [allOrdersList]);

  const handleCopyAllForEmail = async () => {
    if (pickedOrders.length === 0) {
        toast({ variant: 'destructive', title: 'No Picked Orders', description: 'There are no completed orders to export.' });
        return;
    }

    function escapeHtml(s: string | number | undefined | null) {
        if (s === undefined || s === null) return '';
        return String(s)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }
    
    let fullHtml = `<html><head><style>
        body { font-family: sans-serif; font-size: 12px; }
        h1, h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .status-picked { color: green; font-weight: bold; }
        .status-subbed { color: blue; font-weight: bold; }
        .status-missing { color: red; font-weight: bold; }
        .status-partial { color: orange; font-weight: bold; }
    </style></head><body><h1>Picking Summary</h1>`;

    pickedOrders.forEach(order => {
        fullHtml += `
            <h2>Order for ${escapeHtml(order.customerName)}</h2>
            <p><strong>Slot:</strong> ${escapeHtml(order.collectionSlot)} | <strong>ID:</strong> ${escapeHtml(order.id)}</p>
            <table>
                <thead>
                    <tr>
                        <th>Image</th>
                        <th>SKU</th>
                        <th>Name</th>
                        <th>Qty</th>
                        <th>Status</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
        `;
        order.products.forEach(p => {
            const pickedOriginals = p.pickedItems.filter(item => !item.isSubstitute);
            const substitutes = p.pickedItems.filter(item => item.isSubstitute && item.sku !== 'MISSING');
            const missingCount = p.pickedItems.filter(item => item.sku === 'MISSING').length;
            
            let statusHtml = '';
            let detailsHtml = '';

            if (pickedOriginals.length >= p.quantity) {
                statusHtml = `<span class="status-picked">Picked</span>`;
            } else if (missingCount >= p.quantity) {
                statusHtml = `<span class="status-missing">Missing</span>`;
            } else if (substitutes.length > 0 && (pickedOriginals.length + substitutes.length) >= p.quantity) {
                statusHtml = `<span class="status-subbed">Substituted</span>`;
            } else if (pickedOriginals.length > 0 || substitutes.length > 0) {
                statusHtml = `<span class="status-partial">Partially Picked</span>`;
            } else {
                 statusHtml = `<span class="status-missing">Missing</span>`;
            }
            
            if (pickedOriginals.length > 0 && pickedOriginals.length < p.quantity) {
                 detailsHtml += `Picked: ${pickedOriginals.length}<br>`;
            }
            if (substitutes.length > 0) {
                detailsHtml += substitutes.map(s => `Sub: ${escapeHtml(s.details?.name)} (SKU: ${s.sku})`).join('<br>');
            }
             if (missingCount > 0) {
                detailsHtml += `Missing: ${missingCount}`;
            }

            const imageUrl = p.details?.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png';

            fullHtml += `
                <tr>
                    <td><img src="${imageUrl}" width="60" height="60" style="object-fit:cover;border-radius:4px;"></td>
                    <td>${escapeHtml(p.sku)}</td>
                    <td>${escapeHtml(p.name)}</td>
                    <td>${p.quantity}</td>
                    <td>${statusHtml}</td>
                    <td>${detailsHtml}</td>
                </tr>
            `;
        });
        fullHtml += `</tbody></table>`;
    });

    fullHtml += `</body></html>`;
    
    try {
        const blob = new Blob([fullHtml], { type: 'text/html' });
        const data = [new ClipboardItem({ 'text/html': blob })];
        await navigator.clipboard.write(data);
        toast({ title: "Copied for Email", description: `Summary of ${pickedOrders.length} orders copied to clipboard.` });
    } catch (copyError) {
        console.error("HTML copy failed:", copyError);
        toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy data to clipboard. Your browser may not support rich text copying.' });
    }
  };

  const handleExportAllToChat = async () => {
    if (pickedOrders.length === 0) {
        toast({ variant: 'destructive', title: 'No Picked Orders', description: 'There are no completed orders to export.' });
        return;
    }
    
    const DEFAULT_WEBHOOK = 'https://chat.googleapis.com/v1/spaces/AAQA0I44GoE/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=ScysZAnKmUOE3ZhkcTVP-9xL8RXYhJPYXW37kwY2wdw';
    const webhookUrl = settings.chatWebhookUrl || DEFAULT_WEBHOOK;

    toast({ title: 'Exporting to Chat...', description: `Sending summary of ${pickedOrders.length} orders.` });
    
    try {
        const sections = pickedOrders.map(order => {
            const pickedCount = order.products.filter(p => p.pickedItems.some(i => !i.isSubstitute)).length;
            const subbedCount = order.products.filter(p => p.pickedItems.some(i => i.isSubstitute && i.sku !== 'MISSING')).length;
            const missingCount = order.products.filter(p => p.pickedItems.some(i => i.sku === 'MISSING')).length;

            const headerSummary = `<b>${order.customerName}</b> (${order.collectionSlot})<br>Items: ${order.products.length} | Picked: ${pickedCount} | Subbed: ${subbedCount} | Missing: ${missingCount}`;
            
            const lineItemsWidgets = order.products.map(p => {
                const pickedOriginals = p.pickedItems.filter(item => !item.isSubstitute);
                const substitutes = p.pickedItems.filter(item => item.isSubstitute && item.sku !== 'MISSING');
                const missingCount = p.pickedItems.filter(item => item.sku === 'MISSING').length;
                
                let status = ``;
                if (pickedOriginals.length > 0) status += `✓ Picked (x${pickedOriginals.length}) `;
                if (substitutes.length > 0) {
                    substitutes.forEach(sub => {
                         status += `↪ Sub: ${sub.details?.name || sub.sku} `;
                    });
                }
                if (missingCount > 0) status += `✗ Missing (x${missingCount})`;

                return { "textParagraph": { "text": `• <b>${p.name}</b> (SKU: ${p.sku}) - <i>${status.trim()}</i>` } };
            });

            return {
                "header": headerSummary,
                "collapsible": true,
                "uncollapsibleWidgetsCount": 1,
                "widgets": lineItemsWidgets
            };
        });

        const payload = {
            "cardsV2": [{
                "cardId": `picked-orders-report-${Date.now()}`,
                "card": {
                    "header": {
                        "title": "Picking Summary",
                        "subtitle": `${pickedOrders.length} order(s) completed in Store ${settings.locationId}`,
                        "imageUrl": "https://cdn-icons-png.flaticon.com/512/1319/1319818.png",
                        "imageType": "CIRCLE",
                    },
                    "sections": sections,
                },
            }]
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            toast({ title: 'Export Successful', description: 'The order summary was sent to Google Chat.' });
        } else {
             throw new Error(`Webhook failed with status ${response.status}: ${await response.text()}`);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to export to chat:', error);
        toast({
            variant: 'destructive',
            title: 'Export Failed',
            description: `Could not send report to Google Chat. ${errorMessage}`,
            duration: 10000,
        });
    }
  };

  const handleDailyReportExport = (dateKey: string) => {
    const ordersForDay = Object.values(groupedOrders[dateKey] || {}).flat();
    if (ordersForDay.length === 0) {
      toast({ variant: 'destructive', title: 'No Orders', description: 'No orders to export for this day.' });
      return;
    }

    const productSummary: Record<string, { name: string; location: string; total: number; orders: Set<string>; details: Product | null }> = {};

    ordersForDay.forEach(order => {
      order.products.forEach(product => {
        if (!productSummary[product.sku]) {
          productSummary[product.sku] = {
            name: product.name,
            location: product.details?.location.standard || 'N/A',
            total: 0,
            orders: new Set<string>(),
            details: product.details || null
          };
        }
        productSummary[product.sku].total += product.quantity;
        productSummary[product.sku].orders.add(order.id);
      });
    });

    const csvHeader = "Name,SKU,Location,TotalOrdered,OrderCount\n";
    const csvRows = Object.entries(productSummary).map(([sku, summary]) => {
      const row = [
        `"${summary.name.replace(/"/g, '""')}"`,
        sku,
        `"${summary.location.replace(/"/g, '""')}"`,
        summary.total,
        summary.orders.size
      ];
      return row.join(',');
    });

    const csvContent = csvHeader + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `daily_order_report_${dateKey}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
     toast({ title: 'Exporting Report', description: `A CSV report for ${dateKey} is being downloaded.` });
  }

  if (activeOrder) {
    return (
        <main className="container mx-auto px-4 py-8 md:py-12">
            <Card className="mb-4">
                <CardHeader className="flex-row items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => { setActiveOrder(null); setIsScannerActive(false); }}>
                        <ArrowLeft />
                    </Button>
                    <div>
                        <CardTitle>Picking for {activeOrder.customerName}</CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="flex items-center gap-2"><Hash className="h-4 w-4" />{activeOrder.id}</span>
                          <span className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />{activeOrder.collectionSlot}</span>
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="px-6 pb-4">
                    <div className="flex items-center space-x-2">
                        <Switch id="speed-mode" checked={isSpeedMode} onCheckedChange={setIsSpeedMode} />
                        <Label htmlFor="speed-mode" className="flex items-center gap-2">
                            <Bolt className={cn("h-4 w-4 transition-colors", isSpeedMode ? "text-primary" : "text-muted-foreground")} />
                            Speed Mode (Continuous Scan)
                        </Label>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={substituteDialogOpen} onOpenChange={setSubstituteDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Substitute for {substitutingFor?.name}</DialogTitle>
                        <DialogDescription>Search for a replacement item, or scan any product as a substitute.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[70vh] overflow-y-auto p-1">
                        <SearchComponent defaultQuery={suggestedSubQuery} onPick={handleSubSearchPick} />
                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                Or
                                </span>
                            </div>
                        </div>
                        {isScannerActive ? (
                             <div className="space-y-2">
                                <ZXingScanner
                                    ref={scannerRef}
                                    onResult={handleSubScan}
                                    onError={(e) => console.warn(e)}
                                />
                                <Button variant="outline" className="w-full" onClick={() => setIsScannerActive(false)}>Cancel Scan</Button>
                            </div>
                        ) : (
                            <Button className="w-full" variant="outline" onClick={() => setIsScannerActive(true)}>
                                <ScanLine className="mr-2 h-4 w-4" />
                                Scan Your Own Substitute
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {isScannerActive && !substituteDialogOpen && (
                <div className="sticky top-0 z-40 p-2 shadow-md mb-4 bg-background/95 backdrop-blur-sm border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold">Scan to Pick</h3>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setIsScannerActive(false); setSubstitutingFor(null); }}>
                            <X />
                        </Button>
                    </div>
                    <ZXingScanner
                        ref={scannerRef}
                        onResult={handleScanToPick}
                        onError={(e) => console.warn(e)}
                    />
                </div>
            )}
            
            <div className="space-y-8">
                {aisleKeys.map(aisle => (
                    <div key={aisle}>
                        <h2 className="font-bold text-xl mb-4 border-b-2 border-primary pb-2">{aisle}</h2>
                        <div className="space-y-4">
                            {groupedAndSortedProducts[aisle].map(p => {
                                const isFullyPicked = p.pickedItems.length >= p.quantity;
                                const pickedOriginalCount = p.pickedItems.filter(item => !item.isSubstitute).length;
                                const substitutes = p.pickedItems.filter(item => item.isSubstitute && item.sku !== 'MISSING');
                                const missingCount = p.pickedItems.filter(item => item.sku === 'MISSING').length;

                                if (!p.details) {
                                return (
                                    <Card key={p.sku} className="flex items-start gap-4 p-4 transition-opacity bg-muted/50">
                                        <p className="text-sm text-muted-foreground">Details for {p.name} (SKU: {p.sku}) could not be loaded.</p>
                                    </Card>
                                )
                                }
                                const isOpen = openItemId === p.sku;

                                return (
                                    <Collapsible key={p.sku} open={isOpen} onOpenChange={() => handleItemToggle(p.sku)} className={cn("rounded-lg border transition-opacity", isFullyPicked && 'opacity-50')}>
                                        <div className="flex items-center gap-4 p-4">
                                            <div className="flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={isFullyPicked}
                                                    className="h-8 w-8"
                                                    onClick={() => handleManualPick(p.sku!, isFullyPicked ? -p.quantity : p.quantity)}
                                                />
                                                <div className="text-sm font-bold bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-1 border">
                                                    <span className={cn(isFullyPicked && 'text-primary')}>{pickedOriginalCount}</span>/{p.quantity}
                                                </div>
                                            </div>
                                            <CollapsibleTrigger asChild>
                                                <div className="flex-grow flex items-center gap-4 min-w-0 cursor-pointer">
                                                     <ImageModal src={p.details.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'} alt={p.name}>
                                                        <div className="relative w-16 h-16 flex-shrink-0 cursor-pointer group/image">
                                                            <Image
                                                                src={p.details.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'}
                                                                alt={p.name}
                                                                width={64}
                                                                height={64}
                                                                className="rounded-md border object-cover"
                                                            />
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity rounded-md">
                                                                <Expand className="h-6 w-6 text-white" />
                                                            </div>
                                                        </div>
                                                    </ImageModal>
                                                    <div className="flex-grow min-w-0">
                                                        <p className="font-semibold">{p.name}</p>
                                                        <p className="text-sm text-muted-foreground">SKU: {p.sku}</p>
                                                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1"><MapPin className='h-4 w-4' /> {p.details.location.standard}</p>
                                                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1"><PoundSterling className='h-4 w-4' /> £{p.details.price.regular?.toFixed(2)}</p>
                                                         {substitutes.length > 0 && (
                                                            <Badge variant="secondary" className="mt-1">{substitutes.length} substitute(s)</Badge>
                                                        )}
                                                        {missingCount > 0 && (
                                                            <Badge variant="destructive" className="mt-1">{missingCount} missing</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </CollapsibleTrigger>
                                            <div className='flex flex-col items-center gap-2' onClick={(e) => e.stopPropagation()}>
                                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => handleManualPick(p.sku!, 1)} disabled={pickedOriginalCount >= p.quantity}>+</Button>
                                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => handleManualPick(p.sku!, -1)} disabled={pickedOriginalCount === 0}>-</Button>
                                            </div>
                                        </div>
                                    <CollapsibleContent>
                                        <div className="px-4 pb-4 space-y-2">
                                            {!isFullyPicked && (
                                                <Button variant="outline" className="w-full" onClick={() => handleSubstitute(p)}>
                                                        <Replace className="mr-2 h-4 w-4" />
                                                        Substitute
                                                </Button>
                                            )}
                                                {substitutes.length > 0 && (
                                                    <div className='space-y-2'>
                                                        <h4 className='font-semibold text-sm'>Substitutes Picked:</h4>
                                                        {substitutes.map((sub, i) => (
                                                            <Card key={`${sub.sku}-${i}`} className="p-2 flex items-center gap-2">
                                                                <Image src={sub.details?.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'} alt={sub.details?.name || 'sub'} width={40} height={40} className="rounded-md border object-cover" />
                                                                <div className='text-sm'>
                                                                    <p className='font-medium'>{sub.details?.name}</p>
                                                                    <p className='text-xs text-muted-foreground'>SKU: {sub.sku}</p>
                                                                </div>
                                                            </Card>
                                                        ))}
                                                    </div>
                                                )}
                                                {missingCount > 0 && (
                                                    <div className='space-y-2'>
                                                        <h4 className='font-semibold text-sm text-destructive'>Missing Items:</h4>
                                                        <Card className="p-3 flex items-center gap-3 bg-destructive/10 border-destructive/20">
                                                            <PackageX className="h-6 w-6 text-destructive" />
                                                            <p className="font-medium text-destructive">{missingCount} unit(s) marked as missing.</p>
                                                        </Card>
                                                    </div>
                                                )}
                                            <ProductCard
                                                product={p.details}
                                                layout="list"
                                                isPicker={false} // Let the parent handle pick state
                                                locationId={settings.locationId}
                                            />
                                        </div>
                                    </CollapsibleContent>
                                    </Collapsible>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <AlertDialog open={isCompletionAlertOpen} onOpenChange={setIsCompletionAlertOpen}>
                <AlertDialogTrigger asChild>
                    <Button className="w-full mt-8" size="lg" onClick={handleMarkOrderComplete}>
                        <CheckCheck className="mr-2" /> Mark Order as Complete
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Complete Order with Missing Items?</AlertDialogTitle>
                        <AlertDialogDescription>
                            There {unpickedCount === 1 ? 'is 1 item' : `are ${unpickedCount} items`} not fully picked. Completing the order will mark them as unavailable. Are you sure you want to proceed?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Go Back</AlertDialogCancel>
                        <AlertDialogAction onClick={finishOrderCompletion}>Complete Order</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
  }

  return (
    <>
    <Dialog open={!!viewOrder} onOpenChange={(open) => !open && setViewOrder(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Items for {viewOrder?.customerName}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto pr-4">
                 <ul className="space-y-2 list-disc pl-5">
                    {viewOrder?.products.map(p => {
                       const pickedOriginals = p.pickedItems.filter(item => !item.isSubstitute);
                       const substitutes = p.pickedItems.filter(item => item.isSubstitute && item.sku !== 'MISSING');
                       const missingCount = p.quantity - pickedOriginals.length - substitutes.length;
                       
                       return (
                            <li key={p.sku}>
                                <span className='font-semibold'>{p.name}</span> (x{p.quantity})
                                {p.pickedItems.length > 0 && p.quantity > 0 && (
                                    <div className="pl-4 text-sm text-muted-foreground">
                                        {pickedOriginals.length > 0 && <div>✓ Picked: {pickedOriginals.length}</div>}
                                        {substitutes.map((sub, i) => <div key={i}>↪ Sub: {sub.details?.name || sub.sku}</div>)}
                                        {missingCount > 0 && <div className="text-destructive">✗ Missing: {missingCount}</div>}
                                    </div>
                                )}
                            </li>
                       )
                    })}
                </ul>
            </div>
        </DialogContent>
    </Dialog>
    
    <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent>
             <DialogHeader>
                <DialogTitle>{summaryDialogContent.title} for {summaryDialogContent.order?.customerName}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto pr-4 space-y-3">
                 {summaryDialogContent.products.map(p => (
                     <Card key={p.sku}>
                        <CardContent className="p-3 flex items-center gap-4">
                           <Image src={p.details?.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'} alt={p.name} width={48} height={48} className="rounded-md border object-cover" />
                           <div>
                               <p className="font-semibold text-sm">{p.name}</p>
                               <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>
                           </div>
                        </CardContent>
                     </Card>
                 ))}
            </div>
        </DialogContent>
    </Dialog>

    <main className="container mx-auto px-4 py-8 md:py-12">
        <InstallPrompt />
        <Card className="max-w-4xl mx-auto mb-8">
             <CardHeader>
                <CardTitle>Import Orders</CardTitle>
                <CardDescription>Paste the raw text from the collection point system to import all orders for picking.</CardDescription>
             </CardHeader>
             <CardContent>
                  <form onSubmit={form.handleSubmit(handleImportOrders)} className="space-y-4">
                     <Textarea
                        placeholder="Paste order text here..."
                        className="h-48"
                        {...form.register('rawOrderText')}
                      />
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".txt,.csv" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                            <Upload className="mr-2 h-4 w-4" />
                            Import from File
                        </Button>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageSearch className="mr-2 h-4 w-4" />}
                            Import from Paste
                        </Button>
                      </div>
                  </form>
             </CardContent>
        </Card>
        
        {(ordersFromDb && ordersFromDb.length > 0) || isDbLoading ? (
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Imported Orders</CardTitle>
                            <CardDescription>Select an order to begin picking, or export a summary of all picked orders.</CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                           <TooltipProvider>
                                <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" onClick={handleExportAllToChat} disabled={pickedOrders.length === 0}>
                                        <MessageSquare className="mr-2 h-4 w-4" />
                                        Export to Chat
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Send a formatted summary of all picked orders to a Google Chat webhook.</p>
                                </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" onClick={handleCopyAllForEmail} disabled={pickedOrders.length === 0}>
                                        <Mail className="mr-2 h-4 w-4" />
                                        Copy for Email
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Copy a summary of all picked orders as a rich HTML table for email.</p>
                                </TooltipContent>
                                </Tooltip>
                           </TooltipProvider>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {getSortedDateKeys().map(dateKey => {
                        const timeKeysForDate = getSortedTimeKeys(dateKey);
                        const hasActiveOrdersForDate = timeKeysForDate.some(timeKey => 
                            groupedOrders[dateKey]?.[timeKey]?.some(order => !order.isArchived)
                        );

                        if (!hasActiveOrdersForDate) return null;

                        return (
                            <div key={dateKey}>
                                <div className="flex justify-between items-center mb-4 border-b-2 border-primary pb-2">
                                    <h2 className="font-bold text-xl">
                                        {dateKey}
                                    </h2>
                                    <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                             <Button variant="outline" size="sm" onClick={() => handleDailyReportExport(dateKey)}>
                                                <FileDown className="mr-2 h-4 w-4" />
                                                Daily Report
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Export a CSV summary of all products ordered for this day.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    </TooltipProvider>
                                </div>
                                {timeKeysForDate.map(timeKey => {
                                    const activeOrdersInSlot = groupedOrders[dateKey]?.[timeKey]?.filter(o => !o.isArchived) || [];
                                    if (activeOrdersInSlot.length === 0) return null;

                                    return (
                                        <div key={timeKey} className="ml-0 md:ml-4">
                                            <h3 className="font-semibold text-lg mb-2 border-b pb-1">
                                                Slot: {timeKey}
                                            </h3>
                                            <div className="space-y-4 md:pl-4">
                                                {activeOrdersInSlot.map(order => (
                                                    <div
                                                        key={order.id} 
                                                        className={cn(
                                                            "p-4 rounded-lg border",
                                                            !order.isPicked && 'cursor-pointer hover:bg-accent'
                                                        )}
                                                        onClick={() => !order.isPicked && handleSelectOrder(order)}
                                                    >
                                                        <div className="flex justify-between items-start gap-4">
                                                            <div className="space-y-1 flex-grow">
                                                                <p className="font-semibold flex items-center gap-2">
                                                                    <User className="h-4 w-4" />
                                                                    {order.customerName}
                                                                </p>
                                                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                                <Hash className="h-4 w-4" />
                                                                {order.id}
                                                                </p>
                                                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                                    <ListOrdered className="h-4 w-4" />
                                                                    {order.products.length} unique items
                                                                </p>
                                                            </div>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="-mr-2 -mt-2">
                                                                        <MoreVertical />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent>
                                                                    {order.phoneNumber && (
                                                                        <DropdownMenuItem asChild>
                                                                            <a href={`tel:${order.phoneNumber}`}>
                                                                                <Phone className="mr-2 h-4 w-4" /> Call Customer
                                                                            </a>
                                                                    </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem onClick={() => handleViewOrder(order)}>
                                                                        <Eye className="mr-2 h-4 w-4" /> View Items
                                                                    </DropdownMenuItem>
                                                                    {order.isPicked && (
                                                                    <DropdownMenuItem onClick={() => handleExportOrder(order)}>
                                                                        <Copy className="mr-2 h-4 w-4" /> Export Summary
                                                                    </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem onClick={() => handleRepickOrder(order.id)}>
                                                                        <RefreshCw className="mr-2 h-4 w-4" /> Repick Order
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleToggleOrderArchived(order.id, true)} className="text-destructive">
                                                                        <Archive className="mr-2 h-4 w-4" /> Archive Order
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                        {order.isPicked && (
                                                            <div className="mt-2 pt-2 border-t">
                                                                <OrderSummary order={order} onShowDetails={handleShowSummaryDetails} />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                    {archivedOrders.length > 0 && (
                        <Collapsible className="mt-6">
                            <CollapsibleTrigger asChild>
                                <div className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent">
                                    <div className="flex items-center gap-2 font-semibold text-lg">
                                        <Archive className="h-5 w-5" />
                                        Archived Orders ({archivedOrders.length})
                                    </div>
                                    <ChevronDown className="h-5 w-5" />
                                </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-4 space-y-4">
                                {archivedOrders.map(order => (
                                     <div key={order.id} className="p-4 rounded-lg border opacity-70">
                                          <div className="flex justify-between items-start gap-4">
                                            <div className="space-y-1 flex-grow">
                                                <p className="font-semibold flex items-center gap-2">
                                                    <User className="h-4 w-4" />
                                                    {order.customerName}
                                                </p>
                                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <CalendarClock className="h-4 w-4" />
                                                    {order.collectionSlot}
                                                </p>
                                            </div>
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="-mr-2 -mt-2">
                                                        <MoreVertical />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                     <DropdownMenuItem onClick={() => handleViewOrder(order)}>
                                                        <Eye className="mr-2 h-4 w-4" /> View Items
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleExportOrder(order)}>
                                                        <Copy className="mr-2 h-4 w-4" /> Export Summary
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleToggleOrderArchived(order.id, false)}>
                                                        <ArchiveRestore className="mr-2 h-4 w-4" /> Un-archive
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                          <div className="mt-2 pt-2 border-t">
                                                <OrderSummary order={order} onShowDetails={handleShowSummaryDetails} />
                                            </div>
                                     </div>
                                ))}
                            </CollapsibleContent>
                        </Collapsible>
                    )}
                </CardContent>
            </Card>
        ) : !isLoading && !isDbLoading && (
             <Card className="max-w-4xl mx-auto">
                <CardContent className="p-12 text-center">
                    <Bot className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Import orders from the collection point system to begin.</p>
                </CardContent>
            </Card>
        )}
    </main>
    </>
  );
}
