

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
import { Loader2, PackageSearch, ScanLine, X, Check, Info, Undo2, Trash2, Link as LinkIcon, CameraOff, Zap, Share2, Copy, Settings, WifiOff, Wifi, RefreshCw, Bolt, Bot, Map, ScanSearch, AlertTriangle, ChevronsUpDown, DownloadCloud, ArrowLeft, User, ListOrdered, CheckCheck, MoreVertical, Phone, Eye, PackageCheck, Upload, CalendarClock, Hash, ChevronDown, Replace } from 'lucide-react';
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


// TYPES
type Product = FetchMorrisonsDataOutput[0];

interface PickedItem {
    sku: string;
    isSubstitute: boolean;
}

interface OrderProduct {
    sku: string;
    name: string;
    quantity: number;
    pickedItems: PickedItem[];
    details?: Product;
}

interface Order {
    id: string;
    customerName: string;
    collectionSlot: string;
    phoneNumber?: string;
    products: OrderProduct[];
    isPicked: boolean;
}

// State is now nested: { "25-11-2025": { "16:00 - 17:00": [Order, ...] } }
type GroupedOrders = Record<string, Record<string, Order[]>>;


const FormSchema = z.object({
  rawOrderText: z.string().min(10, 'Please paste in the order text.'),
});

const LOCAL_STORAGE_KEY_ORDERS = 'morricards-orders';


const parseOrderText = (text: string): Order[] => {
    const orders: Order[] = [];
    const orderSections = text.split(/(?=COLLECTION POINT OPERATIONS\nBACK\nOrder for)/).filter(s => s.trim() !== '');

    orderSections.forEach((section) => {
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
        
        const finalOrderId = orderRefMatch ? orderRefMatch[1] : `manual-${Date.now()}`;

        if (productMap.size > 0) {
            orders.push({
                id: finalOrderId,
                customerName: customerNameMatch[1].trim(),
                collectionSlot: collectionSlotMatch ? collectionSlotMatch[1].trim() : 'N/A',
                phoneNumber: phoneMatch ? phoneMatch[1].trim() : undefined,
                products: Array.from(productMap.entries()).map(([sku, { name, quantity }]) => ({
                    sku,
                    name,
                    quantity,
                    pickedItems: [],
                })),
                isPicked: false,
            });
        }
    });

    return orders;
};


export default function PickingListClient() {
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrders>({});
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [viewOrder, setViewOrder] = useState<Order | null>(null); // For read-only view
  const [isLoading, setIsLoading] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [sortConfig, setSortConfig] = useState<string>('walkSequence-asc');
  const [isCompletionAlertOpen, setIsCompletionAlertOpen] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [substitutingFor, setSubstitutingFor] = useState<OrderProduct | null>(null);


  const { toast, dismiss } = useToast();
  const { playSuccess, playError, playInfo } = useAudioFeedback();
  const { settings } = useApiSettings();
  const { isOnline } = useNetworkSync();
  const scannerRef = useRef<{ start: () => void; stop: () => void; getOcrDataUri: () => string | null; } | null>(null);
  const groupedOrdersRef = useRef(groupedOrders);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    groupedOrdersRef.current = groupedOrders;
  }, [groupedOrders]);

  useEffect(() => {
    try {
      const savedOrders = localStorage.getItem(LOCAL_STORAGE_KEY_ORDERS);
      if (savedOrders) {
        setGroupedOrders(JSON.parse(savedOrders));
      }
    } catch (error) {
      console.error("Failed to load orders from local storage", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(groupedOrders));
  }, [groupedOrders]);

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
            // Note: month is 0-indexed in JS Dates
            const date = new Date(year, month - 1, day, parseInt(startTime.split(':')[0]), parseInt(startTime.split(':')[1]));
             if (!isNaN(date.getTime())) {
              return [date, dateMatch[0], timeMatch[0]];
            }
        }
      } catch (e) {
        // Fallthrough on parsing error
      }
      return [defaultDate, "Unsorted", "N/A"];
  };


  const handleImportOrders = async (values: z.infer<typeof FormSchema>) => {
    setIsLoading(true);
    const parsedOrders = parseOrderText(values.rawOrderText);

    if (parsedOrders.length === 0) {
      playError();
      toast({ variant: 'destructive', title: 'Import Failed', description: 'Could not find any valid orders in the text.' });
      setIsLoading(false);
      return;
    }

    const allSkus = new Set<string>();
    parsedOrders.forEach(order => order.products.forEach(p => allSkus.add(p.sku)));

    toast({ title: 'Import Successful', description: `Found ${parsedOrders.length} orders. Fetching product details...` });

    const { data: productDetails, error } = await getProductData({
        locationId: settings.locationId,
        skus: Array.from(allSkus),
        bearerToken: settings.bearerToken,
        debugMode: settings.debugMode,
    });
    
    if (error) {
        toast({ variant: 'destructive', title: 'Product Fetch Error', description: error });
    }

    const productMap = new window.Map<string, Product>();
    if (productDetails) {
        productDetails.forEach(p => productMap.set(p.sku, p));
    }
    
    const enrichedOrders = parsedOrders.map(order => ({
        ...order,
        products: order.products.map(p => ({ ...p, details: productMap.get(p.sku) })),
    }));

    const newGroups: GroupedOrders = { ...groupedOrders };
    enrichedOrders.forEach(order => {
        const slot = order.collectionSlot;
        const [, dateKey, timeKey] = parseSlot(slot);

        if (!newGroups[dateKey]) {
            newGroups[dateKey] = {};
        }
        if (!newGroups[dateKey][timeKey]) {
            newGroups[dateKey][timeKey] = [];
        }
        // Avoid adding duplicate orders
        if (!newGroups[dateKey][timeKey].some(o => o.id === order.id)) {
            newGroups[dateKey][timeKey].push(order);
        }
    });

    setGroupedOrders(newGroups);
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
     let orderToRepick: Order | undefined;
     
     for (const date in groupedOrders) {
        for (const time in groupedOrders[date]) {
            orderToRepick = groupedOrders[date][time].find(o => o.id === orderId);
            if(orderToRepick) break;
        }
        if(orderToRepick) break;
     }
     
     if (!orderToRepick) return;

     const resetOrder: Order = {
        ...orderToRepick,
        isPicked: false,
        products: orderToRepick.products.map(p => ({ ...p, pickedItems: [] })),
     };
     
     setGroupedOrders(prev => {
         const newGroups = { ...prev };
         const [, dateKey, timeKey] = parseSlot(resetOrder.collectionSlot);

         if (newGroups[dateKey] && newGroups[dateKey][timeKey]) {
             newGroups[dateKey][timeKey] = newGroups[dateKey][timeKey].map(o => o.id === orderId ? resetOrder : o);
         }
         return newGroups;
     });
     handleSelectOrder(resetOrder);
  }

  const handleMarkCollected = (orderId: string) => {
     setGroupedOrders(prev => {
        const newGroups = { ...prev };
        for (const dateKey in newGroups) {
            for (const timeKey in newGroups[dateKey]) {
                newGroups[dateKey][timeKey] = newGroups[dateKey][timeKey].filter(o => o.id !== orderId);
                if (newGroups[dateKey][timeKey].length === 0) {
                    delete newGroups[dateKey][timeKey];
                }
            }
            if (Object.keys(newGroups[dateKey]).length === 0) {
                delete newGroups[dateKey];
            }
        }
        return newGroups;
    });
    toast({ title: 'Order Collected', description: 'The order has been removed from the list.' });
  }

  const handleViewOrder = (order: Order) => {
    setViewOrder(order);
  }

  const updateActiveOrderAndGroups = (updatedOrder: Order) => {
     setActiveOrder(updatedOrder);
     setGroupedOrders(prev => {
        const newGroups = { ...prev };
        const [, dateKey, timeKey] = parseSlot(updatedOrder.collectionSlot);

        if (newGroups[dateKey] && newGroups[dateKey][timeKey]) {
            newGroups[dateKey][timeKey] = newGroups[dateKey][timeKey].map(o => o.id === updatedOrder.id ? updatedOrder : o);
        }
        return newGroups;
     });
  };

  const handleScanToPick = useCallback((text: string) => {
    if (substitutingFor) {
        handleScanToSubstitute(text);
        return;
    }

    const sku = text.split(',')[0].trim();
    if (!activeOrder || !sku) return;

    const productIndex = activeOrder.products.findIndex(p => p.sku === sku || p.details?.scannedSku === sku || p.details?.primaryEan13 === sku);

    if (productIndex === -1) {
        playError();
        toast({ variant: 'destructive', title: 'Item Not in This Order' });
        return;
    }
    
    const product = activeOrder.products[productIndex];

    if (product.pickedItems.length >= product.quantity) {
        playInfo();
        toast({ title: 'Already Picked', description: `All units of ${product.name} have been picked.`, icon: <Info /> });
        return;
    }
    
    playSuccess();
    
    const newProducts = [...activeOrder.products];
    newProducts[productIndex] = {
        ...newProducts[productIndex],
        pickedItems: [...newProducts[productIndex].pickedItems, { sku, isSubstitute: false }]
    };
    
    updateActiveOrderAndGroups({ ...activeOrder, products: newProducts });

    toast({ title: 'Item Picked', description: `${product.name} (${product.pickedItems.length + 1}/${product.quantity})`, icon: <Check /> });

  }, [activeOrder, playError, playInfo, playSuccess, toast, substitutingFor]);

  const handleManualPick = (sku: string, amount: number) => {
     if (!activeOrder) return;
     
     const productIndex = activeOrder.products.findIndex(p => p.sku === sku);
     if (productIndex === -1) return;

     const product = activeOrder.products[productIndex];
     const currentPickedCount = product.pickedItems.filter(p => !p.isSubstitute).length;
     const newPickedCount = Math.max(0, Math.min(product.quantity, currentPickedCount + amount));

     let newPickedItems = [...product.pickedItems];

     if (amount > 0) { // Adding items
        for(let i = 0; i < amount; i++) {
            if (newPickedItems.length < product.quantity) {
                 newPickedItems.push({ sku: product.sku, isSubstitute: false });
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

     updateActiveOrderAndGroups({ ...activeOrder, products: newProducts });
  }

  const handleSubstitute = (product: OrderProduct) => {
      setSubstitutingFor(product);
      setIsScannerActive(true);
  }
  
  const handleScanToSubstitute = async (scannedSku: string) => {
    if (!activeOrder || !substitutingFor) return;

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
      return;
    }

    const subProduct = data[0];
    playSuccess();
    
    const newProducts = activeOrder.products.map(p => {
        if (p.sku === substitutingFor.sku) {
            const newPickedItems = [...p.pickedItems, { sku: subProduct.sku, isSubstitute: true }];
            return { ...p, pickedItems: newPickedItems };
        }
        return p;
    });

    // Also need to add the sub product details to the order for rendering
    const updatedOrder = { 
        ...activeOrder, 
        products: newProducts.some(p => p.sku === subProduct.sku) 
            ? newProducts
            : [...newProducts, { sku: subProduct.sku, name: subProduct.name, quantity: 0, pickedItems: [], details: subProduct }]
    };

    updateActiveOrderAndGroups(updatedOrder);

    toast({ title: 'Substitute Added', description: `${subProduct.name} was added as a substitute for ${substitutingFor.name}.` });
    setSubstitutingFor(null);
  };


  
  const finishOrderCompletion = () => {
    if (!activeOrder) return;
    
    const updatedOrder = { ...activeOrder, isPicked: true };
    updateActiveOrderAndGroups(updatedOrder);

    setActiveOrder(null);
    setIsScannerActive(false);
    playSuccess();
    toast({ title: 'Order Complete!', description: `Order for ${activeOrder.customerName} has been marked as picked.` });
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

  const getSortedDateKeys = () => {
      return Object.keys(groupedOrders).sort((a, b) => {
          const dateA = a.split('-').reverse().join('-');
          const dateB = b.split('-').reverse().join('-');
          return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
  };
  
  const getSortedTimeKeys = (dateKey: string) => {
      if (groupedOrders[dateKey]) {
        return Object.keys(groupedOrders[dateKey]).sort((a, b) => {
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

  const unpickedCount = activeOrder?.products.filter(p => p.pickedItems.length < p.quantity).length || 0;
  
  const handleItemToggle = (id: string) => {
    setOpenItemId(prev => prev === id ? null : id);
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
            </Card>

            {isScannerActive && (
                <div className="sticky top-0 z-40 p-2 shadow-md mb-4 bg-background/95 backdrop-blur-sm border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold">{substitutingFor ? `Scan substitute for ${substitutingFor.name}` : "Scan to Pick"}</h3>
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
            
            <div className="space-y-4">
                {sortedProducts.map(p => {
                    const isFullyPicked = p.pickedItems.length >= p.quantity;
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
                                        <span className={cn(isFullyPicked && 'text-primary')}>{p.pickedItems.length}</span>/{p.quantity}
                                    </div>
                                </div>
                                <CollapsibleTrigger asChild>
                                    <div className="flex-grow flex items-center gap-4 min-w-0 cursor-pointer">
                                        <Image src={p.details.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'} alt={p.name} width={64} height={64} className="rounded-md border object-cover" />
                                        <div className="flex-grow min-w-0">
                                            <p className="font-semibold">{p.name}</p>
                                            <p className="text-sm text-muted-foreground">SKU: {p.sku}</p>
                                             {p.pickedItems.filter(item => item.isSubstitute).length > 0 && (
                                                <div className="text-xs text-amber-600 font-semibold mt-1">
                                                    {p.pickedItems.filter(item => item.isSubstitute).length} substitute(s) picked
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CollapsibleTrigger>
                                <div className='flex flex-col items-center gap-2' onClick={(e) => e.stopPropagation()}>
                                    <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => handleManualPick(p.sku!, 1)} disabled={isFullyPicked}>+</Button>
                                    <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => handleManualPick(p.sku!, -1)} disabled={p.pickedItems.length === 0}>-</Button>
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
                    {viewOrder?.products.map(p => (
                        <li key={p.sku}>
                            <span className='font-semibold'>{p.name}</span> (x{p.quantity})
                        </li>
                    ))}
                </ul>
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
        
        {Object.keys(groupedOrders).length > 0 ? (
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle>Imported Orders</CardTitle>
                    <CardDescription>Select an order to begin picking.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {getSortedDateKeys().map(dateKey => (
                        <div key={dateKey}>
                             <h2 className="font-bold text-xl mb-4 border-b-2 border-primary pb-2">
                                {dateKey}
                            </h2>
                            {getSortedTimeKeys(dateKey).map(timeKey => (
                                <div key={timeKey} className="ml-0 md:ml-4">
                                    <h3 className="font-semibold text-lg mb-2 border-b pb-1">
                                        Slot: {timeKey}
                                    </h3>
                                    <div className="space-y-4 md:pl-4">
                                        {groupedOrders[dateKey][timeKey].map(order => (
                                            <div
                                                key={order.id} 
                                                className={cn(
                                                    "p-4 flex justify-between items-center rounded-lg border",
                                                    order.isPicked ? 'bg-green-50 dark:bg-green-900/20' : 'cursor-pointer hover:bg-accent'
                                                )}
                                                onClick={() => !order.isPicked && handleSelectOrder(order)}
                                            >
                                                <div className="space-y-1">
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
                                                {order.isPicked ? (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
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
                                                            <DropdownMenuItem onClick={() => handleRepickOrder(order.id)}>
                                                                <RefreshCw className="mr-2 h-4 w-4" /> Repick Order
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleMarkCollected(order.id)} className="text-destructive">
                                                                <PackageCheck className="mr-2 h-4 w-4" /> Mark as Collected
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                ) : (
                                                    <div className="text-sm text-primary font-semibold">
                                                        {order.products.filter(p => p.pickedItems.length >= p.quantity).length} / {order.products.length} Picked
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </CardContent>
            </Card>
        ) : !isLoading && (
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
