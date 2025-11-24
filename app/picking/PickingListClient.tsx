

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
import { Loader2, PackageSearch, ScanLine, X, Check, Info, Undo2, Trash2, Link as LinkIcon, CameraOff, Zap, Share2, Copy, Settings, WifiOff, Wifi, RefreshCw, Bolt, Bot, Map, ScanSearch, AlertTriangle, ChevronsUpDown, DownloadCloud, ArrowLeft, User, ListOrdered, CheckCheck, MoreVertical, Phone, Eye, PackageCheck, Upload } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import ZXingScanner from '@/components/ZXingScanner';
import { useApiSettings } from '@/hooks/use-api-settings';
import { useNetworkSync } from '@/hooks/useNetworkSync';
import InstallPrompt from '@/components/InstallPrompt';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { queueProductFetch } from '@/lib/offlineQueue';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';


// TYPES
type Product = FetchMorrisonsDataOutput[0];

interface OrderProduct {
    sku: string;
    name: string;
    quantity: number;
    picked: number;
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

const FormSchema = z.object({
  rawOrderText: z.string().min(10, 'Please paste in the order text.'),
});

const LOCAL_STORAGE_KEY_ORDERS = 'morricards-orders';


const parseOrderText = (text: string): Order[] => {
    const orders: Order[] = [];
    // Split by a line that contains "Order for" to correctly separate orders.
    const orderSections = text.split(/Order for /).filter(Boolean);

    orderSections.forEach((section, i) => {
        const customerNameMatch = section.match(/(.*?)\n/);
        const orderRefMatch = section.match(/Order reference: (\d+)/);
        const collectionSlotMatch = section.match(/Collection slot: (.*?)\n/);
        const phoneMatch = section.match(/Phone number: ([+0-9\s]+)/);

        if (!customerNameMatch) return;

        const contentsSplit = section.split('Order contents');
        if (contentsSplit.length < 2) return;
        
        // Use the order ref as the ID, or a fallback if not found.
        const orderId = orderRefMatch ? orderRefMatch[1] : `imported-order-${Date.now()}-${i}`;

        const productLines = contentsSplit[1].split('\n').filter(l => /^\d{7,}/.test(l.trim()));
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

        if (productMap.size > 0) {
            orders.push({
                id: orderId,
                customerName: customerNameMatch[1].trim(),
                collectionSlot: collectionSlotMatch ? collectionSlotMatch[1].trim() : 'N/A',
                phoneNumber: phoneMatch ? phoneMatch[1].trim() : undefined,
                products: Array.from(productMap.entries()).map(([sku, { name, quantity }]) => ({
                    sku,
                    name,
                    quantity,
                    picked: 0,
                })),
                isPicked: false,
            });
        }
    });

    return orders;
};


export default function PickingListClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [viewOrder, setViewOrder] = useState<Order | null>(null); // For read-only view
  const [isLoading, setIsLoading] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);

  const { toast, dismiss } = useToast();
  const { playSuccess, playError, playInfo } = useAudioFeedback();
  const { settings } = useApiSettings();
  const { isOnline } = useNetworkSync();
  const scannerRef = useRef<{ start: () => void; stop: () => void; getOcrDataUri: () => string | null; } | null>(null);
  const ordersRef = useRef(orders);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    try {
      const savedOrders = localStorage.getItem(LOCAL_STORAGE_KEY_ORDERS);
      if (savedOrders) {
        setOrders(JSON.parse(savedOrders));
      }
    } catch (error) {
      console.error("Failed to load orders from local storage", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(orders));
  }, [orders]);

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
    
    setOrders(enrichedOrders);
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
    // Reset the file input so the same file can be re-uploaded
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleSelectOrder = (order: Order) => {
    setActiveOrder(order);
    setIsScannerActive(true);
  }
  
  const handleRepickOrder = (orderId: string) => {
     const orderToRepick = orders.find(o => o.id === orderId);
     if (!orderToRepick) return;

     const resetOrder: Order = {
        ...orderToRepick,
        isPicked: false,
        products: orderToRepick.products.map(p => ({ ...p, picked: 0 })),
     };
     
     setOrders(prev => prev.map(o => o.id === orderId ? resetOrder : o));
     handleSelectOrder(resetOrder); // Directly enter picking mode for this order
  }

  const handleMarkCollected = (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    toast({ title: 'Order Collected', description: 'The order has been removed from the list.' });
  }

  const handleViewOrder = (order: Order) => {
    setViewOrder(order);
  }

  const handleScanToPick = useCallback((text: string) => {
    const sku = text.split(',')[0].trim();
    if (!activeOrder || !sku) return;

    const productIndex = activeOrder.products.findIndex(p => p.sku === sku || p.details?.scannedSku === sku || p.details?.primaryEan13 === sku);

    if (productIndex === -1) {
        playError();
        toast({ variant: 'destructive', title: 'Item Not in This Order' });
        return;
    }
    
    const product = activeOrder.products[productIndex];

    if (product.picked >= product.quantity) {
        playInfo();
        toast({ title: 'Already Picked', description: `All units of ${product.name} have been picked.`, icon: <Info /> });
        return;
    }
    
    playSuccess();
    
    setOrders(prevOrders => prevOrders.map(o => {
        if (o.id !== activeOrder.id) return o;
        const newProducts = [...o.products];
        newProducts[productIndex] = {
            ...newProducts[productIndex],
            picked: newProducts[productIndex].picked + 1
        };
        return { ...o, products: newProducts };
    }));
    
    // Update active order state directly as well
     setActiveOrder(prevActiveOrder => {
        if (!prevActiveOrder) return null;
        const newProducts = [...prevActiveOrder.products];
        newProducts[productIndex] = { ...newProducts[productIndex], picked: newProducts[productIndex].picked + 1 };
        return { ...prevActiveOrder, products: newProducts };
    });

    toast({ title: 'Item Picked', description: `${product.name} (${product.picked + 1}/${product.quantity})`, icon: <Check /> });

  }, [activeOrder, playError, playInfo, playSuccess, toast]);

  const handleManualPick = (sku: string, amount: number) => {
     setOrders(prevOrders => prevOrders.map(o => {
        if (o.id !== activeOrder!.id) return o;
        return {
            ...o,
            products: o.products.map(p => p.sku === sku ? {...p, picked: Math.min(p.quantity, p.picked + amount)} : p)
        }
     }));
     setActiveOrder(prev => {
        if (!prev) return null;
        return {
            ...prev,
            products: prev.products.map(p => p.sku === sku ? {...p, picked: Math.min(p.quantity, p.picked + amount)} : p)
        }
     });
  }
  
  const handleMarkOrderComplete = () => {
    if (!activeOrder) return;
    
    setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, isPicked: true } : o));
    setActiveOrder(null);
    setIsScannerActive(false);
    playSuccess();
    toast({ title: 'Order Complete!', description: `Order for ${activeOrder.customerName} has been marked as picked.` });
  }

  if (activeOrder) {
    const sortedProducts = [...activeOrder.products].sort((a, b) => {
        if (a.picked === a.quantity && b.picked < b.quantity) return 1;
        if (a.picked < a.quantity && b.picked === b.quantity) return -1;
        
        const walkA = a.details?.productDetails?.legacyItemNumbers?.[0] || '9999';
        const walkB = b.details?.productDetails?.legacyItemNumbers?.[0] || '9999';

        return parseInt(walkA) - parseInt(walkB);
    })

    return (
        <main className="container mx-auto px-4 py-8 md:py-12">
            <Card className="mb-4">
                <CardHeader className="flex-row items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => { setActiveOrder(null); setIsScannerActive(false); }}>
                        <ArrowLeft />
                    </Button>
                    <div>
                        <CardTitle>Picking for {activeOrder.customerName}</CardTitle>
                        <CardDescription>{activeOrder.collectionSlot}</CardDescription>
                    </div>
                </CardHeader>
            </Card>

            <div className="sticky top-0 z-40 p-2 shadow-md mb-4 bg-background/95 backdrop-blur-sm border rounded-lg">
                <ZXingScanner
                    ref={scannerRef}
                    onResult={handleScanToPick}
                    onError={(e) => console.warn(e)}
                />
            </div>
            
            <div className="space-y-4">
                {sortedProducts.map(p => {
                    const isFullyPicked = p.picked >= p.quantity;
                    return (
                        <Card key={p.sku} className={cn("flex items-start gap-4 p-4 transition-opacity", isFullyPicked && 'opacity-50')}>
                             <div className='flex-shrink-0'>
                                <Checkbox
                                    checked={isFullyPicked}
                                    className="h-8 w-8"
                                    onClick={() => handleManualPick(p.sku, isFullyPicked ? -p.quantity : p.quantity)}
                                />
                            </div>
                            {p.details && (
                                <Image
                                    src={p.details.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'}
                                    alt={p.name}
                                    width={64}
                                    height={64}
                                    className="rounded-md border object-cover"
                                />
                            )}
                            <div className="flex-grow">
                                <p className="font-semibold">{p.name}</p>
                                <p className="text-sm text-muted-foreground">{p.details?.location.standard || 'N/A'}</p>
                                <div className='flex items-center gap-4 mt-2'>
                                    <div className="text-lg font-bold">
                                        <span className={cn(isFullyPicked && 'text-primary')}>{p.picked}</span> / {p.quantity}
                                    </div>
                                    <div className='flex items-center gap-2'>
                                        <Button size="sm" variant="outline" onClick={() => handleManualPick(p.sku, -1)} disabled={p.picked === 0}>-</Button>
                                        <Button size="sm" variant="outline" onClick={() => handleManualPick(p.sku, 1)} disabled={isFullyPicked}>+</Button>
                                    </div>
                                </div>
                            </div>
                           
                        </Card>
                    )
                })}
            </div>

            <Button className="w-full mt-8" size="lg" onClick={handleMarkOrderComplete}>
                <CheckCheck className="mr-2" /> Mark Order as Complete
            </Button>
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
        
        {orders.length > 0 && (
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle>Imported Orders</CardTitle>
                    <CardDescription>Select an order to begin picking.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {orders.map(order => (
                        <div
                            key={order.id} 
                            className={cn(
                                "p-4 flex justify-between items-center rounded-lg border",
                                order.isPicked ? 'bg-green-50 dark:bg-green-900/20' : 'cursor-pointer hover:bg-accent'
                            )}
                            onClick={() => !order.isPicked && handleSelectOrder(order)}
                        >
                            <div>
                                <p className="font-semibold flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    {order.customerName}
                                </p>
                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <ListOrdered className="h-4 w-4" />
                                    {order.products.length} unique items
                                </p>
                            </div>
                             {order.isPicked && (
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
                             )}
                        </div>
                    ))}
                </CardContent>
            </Card>
        )}
    </main>
    </>
  );
}
