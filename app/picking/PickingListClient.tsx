

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
import { Loader2, PackageSearch, ScanLine, X, Check, Info, Undo2, Trash2, Link as LinkIcon, CameraOff, Zap, Share2, Copy, Settings, WifiOff, Wifi, RefreshCw, Bolt, Bot, Map, ScanSearch, AlertTriangle, ChevronsUpDown, DownloadCloud, ArrowLeft, User, ListOrdered, CheckCheck } from 'lucide-react';
import ProductCard from '@/components/product-card';
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
    products: OrderProduct[];
    isPicked: boolean;
}

const FormSchema = z.object({
  rawOrderText: z.string().min(10, 'Please paste in the order text.'),
});

const LOCAL_STORAGE_KEY_ORDERS = 'morricards-orders';


const parseOrderText = (text: string): Order[] => {
    const orders: Order[] = [];
    const orderSections = text.split(/Order for /g).filter(Boolean);

    orderSections.forEach((section, i) => {
        const customerNameMatch = section.match(/(.*?)\n/);
        const orderRefMatch = section.match(/Order reference: (\d+)/);
        const collectionSlotMatch = section.match(/Collection slot: (.*?)\n/);

        if (!customerNameMatch || !orderRefMatch) return;

        const productLines = section.split('Order contents')[1]?.split('\n').filter(l => /^\d+\s/.test(l.trim())) || [];
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
                id: orderRefMatch[1],
                customerName: customerNameMatch[1].trim(),
                collectionSlot: collectionSlotMatch ? collectionSlotMatch[1].trim() : 'N/A',
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
  const [isLoading, setIsLoading] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);

  const { toast, dismiss } = useToast();
  const { playSuccess, playError, playInfo } = useAudioFeedback();
  const { settings } = useApiSettings();
  const { isOnline } = useNetworkSync();
  const scannerRef = useRef<{ start: () => void; stop: () => void; getOcrDataUri: () => string | null; } | null>(null);
  const ordersRef = useRef(orders);

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

  const handleSelectOrder = (order: Order) => {
    setActiveOrder(order);
    setIsScannerActive(true);
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
                      <Button type="submit" className="w-full" disabled={isLoading}>
                          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageSearch className="mr-2 h-4 w-4" />}
                          Import and Fetch Products
                      </Button>
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
                        <Card 
                            key={order.id} 
                            className={cn(
                                "p-4 flex justify-between items-center cursor-pointer hover:bg-accent",
                                order.isPicked && 'bg-green-50 dark:bg-green-900/20 opacity-70'
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
                             {order.isPicked && <CheckCheck className="h-6 w-6 text-primary" />}
                        </Card>
                    ))}
                </CardContent>
            </Card>
        )}
    </main>
  );
}
