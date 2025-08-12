
'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useAudioFeedback } from '@/hooks/use-audio-feedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PackageSearch, Search, ShoppingBasket, LayoutGrid, List, ScanLine, X, Check, Info, Undo2, Trash2, Link as LinkIcon, CameraOff, Zap, Share2, Copy, Settings, WifiOff, Wifi, CloudCog, Bolt, Bot, Map } from 'lucide-react';
import ProductCard from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ToastAction } from '@/components/ui/toast';
import Link from 'next/link';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from '@/lib/utils';
import ZXingScanner from '@/components/ZXingScanner';
import { useSearchParams, useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import Image from 'next/image';
import { useApiSettings } from '@/hooks/use-api-settings';
import { useNetworkSync } from '@/hooks/useNetworkSync';
import InstallPrompt from '@/components/InstallPrompt';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { queueProductFetch } from '@/lib/offlineQueue';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ocrFlow } from '@/ai/flows/ocr-flow';


type Product = FetchMorrisonsDataOutput[0] & { picked?: boolean; isOffline?: boolean; };

const FormSchema = z.object({
  skus: z.string().min(1, { message: 'Please enter at least one SKU.' }),
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
});

const LOCAL_STORAGE_KEY = 'morricards-products';

const StatusIndicator = ({ isFetching }: { isFetching: boolean }) => {
  const { isOnline, lastSync } = useNetworkSync();
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    if (lastSync) {
      const update = () => {
        const seconds = Math.floor((Date.now() - lastSync) / 1000);
        if (seconds < 60) setTimeAgo('just now');
        else if (seconds < 3600) setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
        else setTimeAgo(`${Math.floor(seconds / 3600)}h ago`);
      };
      update();
      const interval = setInterval(update, 60000); // every minute
      return () => clearInterval(interval);
    }
  }, [lastSync]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
            {isOnline ? <Wifi className="h-4 w-4 text-primary" /> : <WifiOff className="h-4 w-4 text-destructive" />}
            {lastSync && !isFetching && (
                <>
                  <CloudCog className="h-4 w-4" />
                  <span>Synced: {timeAgo}</span>
                </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
           <p>{isFetching ? 'Fetching data...' : isOnline ? 'You are currently online.' : 'You are currently offline.'}</p>
          {lastSync && <p>Last data sync was {timeAgo}.</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};


function PickingList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [loadingSkuCount, setLoadingSkuCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<string>('walkSequence-asc');
  const [filterQuery, setFilterQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [isScanMode, setIsScanMode] = useState(false);
  const [isSpeedMode, setIsSpeedMode] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportUrl, setExportUrl] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  
  const { toast, dismiss } = useToast();
  const { playSuccess, playError, playInfo } = useAudioFeedback();
  const { settings } = useApiSettings();
  const { isOnline, syncedItems } = useNetworkSync();

  const productsRef = useRef(products);
  const scannerRef = useRef<{ start: () => void; stop: () => void; } | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();


  const startScannerWithDelay = useCallback(() => {
    setTimeout(() => {
        if (isScanMode && scannerRef.current) {
            scannerRef.current.start();
        }
    }, 1500); // 1.5 second delay
  }, [isScanMode]);

  useEffect(() => {
    if (isScanMode) {
      scannerRef.current?.start();
    } else {
      scannerRef.current?.stop();
    }
  }, [isScanMode]);

  // Keep the ref updated with the latest products state
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // Load products from local storage on initial render
  useEffect(() => {
    try {
      const savedProducts = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedProducts) {
        setProducts(JSON.parse(savedProducts));
      }
    } catch (error) {
      console.error("Failed to load products from local storage", error);
    }
  }, []);

  // Save products to local storage whenever they change
  useEffect(() => {
    try {
      // Don't save offline placeholders permanently if they fail to resolve
      const productsToSave = products.filter(p => !p.isOffline || p.name !== 'Offline Item');
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(productsToSave));
    } catch (error) {
      console.error("Failed to save products to local storage", error);
    }
  }, [products]);

  // When synced items come back from the network hook, update the product list
  useEffect(() => {
    if (syncedItems.length > 0) {
      setProducts(prevProducts => {
        const syncedSkus = new Set(syncedItems.map(item => item.sku));
        const otherProducts = prevProducts.filter(p => !syncedSkus.has(p.sku));
        return [...otherProducts, ...syncedItems.map(p => ({ ...p, picked: false }))]
      });
    }
  }, [syncedItems]);


  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      skus: '',
      locationId: '218',
    },
  });

  const skusFromUrl = searchParams.get('skus');
  const locationFromUrl = searchParams.get('location');

  // Handle dynamic links
  useEffect(() => {
    if (skusFromUrl && locationFromUrl) {
      form.setValue('skus', skusFromUrl);
      form.setValue('locationId', locationFromUrl);
      onSubmit({ skus: skusFromUrl, locationId: locationFromUrl });
      
      // Clean the URL to avoid re-triggering on refresh
      router.replace('/', undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skusFromUrl, locationFromUrl]);

  
  const handleUndoPick = useCallback((skuToUndo: string) => {
    setProducts(prevProducts => {
      const newProducts = prevProducts.map(p =>
        p.sku === skuToUndo ? { ...p, picked: false } : p
      );
      return [...newProducts]; 
    });
    
    toast({
        title: 'Undo Successful',
        description: 'The item has been unpicked.',
        icon: <Undo2 className="h-5 w-5 text-blue-500" />
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePick = useCallback((sku: string) => {
    const productCard = document.querySelector(`[data-sku="${sku}"]`);
    const productToUpdate = productsRef.current.find(p => p.sku === sku || p.scannedSku === sku);

    if (productCard && productToUpdate && !productToUpdate.picked) {
        productCard.classList.add('picked-animation');
        
        productCard.addEventListener('animationend', () => {
             setProducts(prev => prev.map(p => p.sku === sku ? { ...p, picked: true } : p));
        }, { once: true });
        
        setTimeout(() => dismiss(), 0);
        playSuccess();
        setTimeout(() => toast({
            title: 'Item Picked',
            description: `Picked: ${productToUpdate.name}`,
            icon: <Check className="h-5 w-5 text-primary" />,
            action: (
                <ToastAction altText="Undo" onClick={() => handleUndoPick(productToUpdate.sku)}>
                    <Undo2 className="mr-1 h-4 w-4" />
                    Undo
                </ToastAction>
            ),
        }), 0);
    } else if (productToUpdate?.picked) {
        // Unpicking is immediate
        setProducts(prev => prev.map(p => p.sku === sku ? { ...p, picked: false } : p));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleScanResult = useCallback(async (text: string) => {
    const sku = text.split(',')[0].trim();
    if (!sku) return;

    if (!isSpeedMode) {
        setIsScanMode(false); // Close scanner on scan only if not in speed mode
    }

    const productToPick = productsRef.current.find(p => p.sku === sku || p.scannedSku === sku);

    if (productToPick) {
        if (productToPick.picked) {
            playInfo();
            toast({ title: 'Item Already Picked', description: `Already picked: ${productToPick.name}`, icon: <Info className="h-5 w-5 text-blue-500" /> });
        } else {
            handlePick(productToPick.sku);
        }
        if (isSpeedMode) startScannerWithDelay();
        return;
    } else {
        const locationId = form.getValues('locationId');
        if (!isOnline) {
            playSuccess();
            toast({ 
                title: 'Offline: Item Queued', 
                description: `Item ${sku} will be fetched when you're back online.`,
                icon: <WifiOff className="h-5 w-5" />
            });
            const placeholder = await queueProductFetch({ sku, locationId });
            setProducts(prev => [...prev, { ...placeholder, picked: false, isOffline: true }]);
            if (isSpeedMode) startScannerWithDelay();
            return;
        }

        playSuccess();
        toast({ title: 'New Item Scanned', description: `Fetching details for EAN: ${sku}` });

        setLoadingSkuCount(prev => prev + 1);
        setIsLoading(true);
        setIsFetching(true);

        
        const { data, error } = await getProductData({
          locationId,
          skus: [sku],
          bearerToken: settings.bearerToken,
          debugMode: settings.debugMode,
        });
        
        setIsFetching(false);
        if (error || !data || data.length === 0) {
            const errText = error || `Could not find product for EAN: ${sku}`;
            playError();
            toast({
                variant: 'destructive',
                title: 'Product Not Found',
                description: errText,
                action: (
                    <ToastAction altText="Copy" onClick={() => navigator.clipboard.writeText(errText)}>
                        <Copy className="mr-2 h-4 w-4" /> Copy
                    </ToastAction>
                ),
            });
        } else {
            setProducts(prevProducts => {
                const existing = prevProducts.find(p => p.sku === data[0].sku);
                if (existing) return prevProducts; // Already added somehow
                return [...prevProducts, { ...data[0], picked: false }];
            });
        }
        
        setIsLoading(false);
        setLoadingSkuCount(prev => Math.max(0, prev - 1));
        if (isSpeedMode) startScannerWithDelay();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlePick, playInfo, playSuccess, toast, playError, form, settings.bearerToken, settings.debugMode, isOnline, isSpeedMode, startScannerWithDelay]);

  const handleScanError = (message: string) => {
    const lowerMessage = message.toLowerCase();
    if (!lowerMessage.includes('not found') && !lowerMessage.includes('no multiformat readers')) {
      toast({
        variant: 'destructive',
        title: 'Scanner Error',
        description: message,
        action: (
            <ToastAction altText="Copy" onClick={() => navigator.clipboard.writeText(message)}>
                <Copy className="mr-2 h-4 w-4" /> Copy
            </ToastAction>
        ),
      });
    }
  };

  const handleOcrRequest = async (imageDataUri: string) => {
    setIsOcrLoading(true);
    toast({ title: 'AI OCR', description: 'Reading numbers from the label...' });
    try {
        const result = await ocrFlow({ imageDataUri });
        if (result.eanOrSku) {
            toast({ title: 'AI OCR Success', description: `Found number: ${result.eanOrSku}` });
            await handleScanResult(result.eanOrSku);
        } else {
            playError();
            toast({ variant: 'destructive', title: 'AI OCR Failed', description: 'Could not find a valid SKU or EAN on the label.' });
        }
    } catch (e) {
        console.error("OCR flow failed", e);
        playError();
        toast({ variant: 'destructive', title: 'AI OCR Error', description: 'An error occurred while reading the image.' });
    } finally {
        setIsOcrLoading(false);
    }
  };

  async function onSubmit(values: z.infer<typeof FormSchema>) {
    const existingSkus = new Set(products.map(p => p.sku));
    const newSkus = values.skus
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(s => s && !existingSkus.has(s));

    if (newSkus.length === 0) {
      toast({
        title: 'No new SKUs to add',
        description: 'All entered SKUs are already in the list.',
      });
      return;
    }
    
    setLoadingSkuCount(newSkus.length);
    setIsLoading(true);
    setIsFetching(true);

    const { data, error } = await getProductData({
      ...values,
      skus: newSkus,
      bearerToken: settings.bearerToken,
      debugMode: settings.debugMode,
    });

    setIsFetching(false);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error,
        duration: 15000,
        action: (
            <ToastAction altText="Copy" onClick={() => navigator.clipboard.writeText(error)}>
                <Copy className="mr-2 h-4 w-4" /> Copy
            </ToastAction>
        ),
      });
    } else if (data) {
       if (data.length === 0) {
        toast({
          title: 'No new products found',
          description: 'Could not find any products for the given SKUs.',
        });
      } else {
        setProducts(prevProducts => {
            const updatedExistingSkus = new Set(prevProducts.map(p => p.sku));
            const uniqueNewProducts = data.filter(p => !updatedExistingSkus.has(p.sku));
            return [...prevProducts, ...uniqueNewProducts.map(p => ({ ...p, picked: false }))]
        });
        form.setValue('skus', '');
      }
    }
    setIsLoading(false);
    setLoadingSkuCount(0);
    if (isScanMode) setIsScanMode(false);
  }

  const sortedAndFilteredProducts = useMemo(() => {
    let result: Product[] = [...products].filter((p) =>
      p.name.toLowerCase().includes(filterQuery.toLowerCase())
    );

    const [key, direction] = sortConfig.split('-');
    
    result.sort((a, b) => {
      if (a.picked && !b.picked) return 1;
      if (!a.picked && b.picked) return -1;
      
      let valA = a[key as keyof Product];
      let valB = b[key as keyof Product];

      if (key === 'price' && valA && valB) {
        valA = (valA as {regular?: number}).regular;
        valB = (valB as {regular?: number}).regular;
      }
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (key === 'walkSequence') {
        valA = Number(valA) || Infinity;
        valB = Number(valB) || Infinity;
      }
      
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (valA < valB) {
        return direction === 'asc' ? -1 : 1;
      }
      if (valA > valB) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return result;
  }, [products, filterQuery, sortConfig]);
  
  const handleScanButtonClick = () => {
    setIsScanMode(prev => !prev);
  }

  const getScanButtonLabel = () => {
    if (products.length > 0) return 'Pick by Scan';
    return 'Scan to Add';
  }

  const handleResetList = () => {
    setProducts([]);
    setFilterQuery('');
    setSortConfig('walkSequence-asc');
    form.reset();
    toast({
        title: 'List Cleared',
        description: 'The picking list has been successfully cleared.',
    });
  }

  const handleOpenExportModal = () => {
    if (products.length === 0) {
      toast({
        title: 'Empty List',
        description: 'Add some products to the list before exporting.',
        variant: 'destructive',
      });
      return;
    }

    const skus = products.map(p => p.sku).join(',');
    const locationId = form.getValues('locationId');
    const url = `${window.location.origin}/?skus=${encodeURIComponent(skus)}&location=${encodeURIComponent(locationId)}`;
    setExportUrl(url);

    QRCode.toDataURL(url, { width: 300, margin: 2 })
      .then(setQrCodeDataUrl)
      .catch(err => {
        console.error('Failed to generate QR code', err);
        toast({
          title: 'QR Code Error',
          description: 'Could not generate a QR code for the list.',
          variant: 'destructive',
        });
      });

    setIsExportModalOpen(true);
  };
  
  const handleCopyExportUrl = () => {
    navigator.clipboard.writeText(exportUrl).then(() => {
      toast({ title: 'URL Copied', description: 'The list URL has been copied to your clipboard.' });
    }).catch(() => {
      toast({ title: 'Copy Failed', description: 'Could not copy the URL.', variant: 'destructive' });
    });
  };

  
  const skeletons = Array.from({ length: loadingSkuCount }).map((_, i) => (
    <Card key={`skeleton-${i}`} className="w-full">
         <Skeleton className="aspect-square w-full" />
        <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
        </CardContent>
    </Card>
  ));


  return (
    <div className="min-h-screen bg-background">
      <InstallPrompt />
      {isScanMode && (
         <div className="fixed inset-x-0 top-0 z-50 bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-md mx-auto relative p-0">
                <ZXingScanner 
                    ref={scannerRef} 
                    onResult={handleScanResult} 
                    onError={handleScanError}
                    onOcrRequest={handleOcrRequest}
                    isOcrLoading={isOcrLoading}
                />
                <Button variant="ghost" size="icon" onClick={() => setIsScanMode(false)} className="absolute top-2 right-2 z-10 bg-black/20 hover:bg-black/50 text-white hover:text-white">
                   <X className="h-5 w-5" />
                </Button>
            </div>
        </div>
      )}

      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Picking List</DialogTitle>
            <DialogDescription>
              Share this URL or QR code with a team member to instantly load this picking list on their device.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex items-center space-x-2">
              <Input value={exportUrl} readOnly className="flex-grow" />
              <Button type="button" size="sm" onClick={handleCopyExportUrl}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
            {qrCodeDataUrl && (
              <div className="flex justify-center p-4 bg-muted rounded-md">
                <Image
                  src={qrCodeDataUrl}
                  alt="Picking List QR Code"
                  width={250}
                  height={250}
                  data-ai-hint="QR code"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <main className="container mx-auto px-4 py-8 md:py-12">
        <TooltipProvider>
          <header className="text-center mb-12">
            <div className="flex justify-center items-center gap-4 relative">
               <ShoppingBasket className="w-12 h-12 text-primary" />
              <h1 className="text-5xl font-bold tracking-tight text-primary">
                Store mobile <span className="text-foreground">ULTRA</span>
              </h1>
               <div className="absolute right-0 top-0">
                <StatusIndicator isFetching={isFetching} />
              </div>
            </div>
             <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Your friendly shopping assistant. Scan EANs or enter SKUs to build your picking list.
            </p>
            <div className="mt-2 space-x-2">
                <Button variant="link" asChild>
                    <Link href="/availability">
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Go to Availability Checker
                    </Link>
                </Button>
                 <Button variant="link" asChild>
                    <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Link>
                </Button>
                 <Button variant="link" asChild>
                    <Link href="/assistant">
                        <Bot className="mr-2 h-4 w-4" />
                        AI Product Assistant
                    </Link>
                </Button>
            </div>
             {!isOnline && (
              <Alert variant="destructive" className="mt-6 max-w-2xl mx-auto text-left">
                  <WifiOff className="h-4 w-4" />
                  <AlertTitle>You are offline</AlertTitle>
                  <AlertDescription>
                      The app is running in offline mode. Some functionality may be limited, but you can still view your list. Any new data will be fetched when you reconnect.
                  </AlertDescription>
              </Alert>
            )}
          </header>
          
          <Card className="max-w-4xl mx-auto mb-12 shadow-lg">
            <CardHeader>
              <CardTitle>Create or Add to Picking List</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="skus"
                    render={({ field }) => (
                      <FormItem>
                         <div className="flex justify-between items-center">
                          <FormLabel>Product SKUs / EANs</FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant='outline'
                                size="sm"
                                onClick={handleScanButtonClick}
                              >
                                <ScanLine className="mr-2 h-4 w-4" />
                                {getScanButtonLabel()}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Use your device's camera to scan barcodes.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder="Scan barcodes or enter SKUs separated by commas, spaces, or new lines... e.g. 369966011, 5010251674078"
                            className="min-h-[120px] resize-y"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="locationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store Location ID</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 218" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center space-x-2 justify-end pt-2">
                    <Switch id="speed-mode" checked={isSpeedMode} onCheckedChange={setIsSpeedMode} />
                    <Label htmlFor="speed-mode" className="flex items-center gap-2">
                        <Bolt className={cn("h-4 w-4 transition-colors", isSpeedMode ? "text-primary" : "text-muted-foreground")} />
                        Speed Mode
                    </Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading || !isOnline}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Fetching Data...
                      </>
                    ) : !isOnline ? (
                      <>
                        <WifiOff className="mr-2 h-4 w-4" />
                        Offline - Cannot Fetch
                      </>
                    ) : (
                      'Get/Add to Picking List'
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          { (products.length > 0 || isLoading) && 
              <div className="mb-8 p-4 bg-card rounded-lg shadow-md">
                  <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                      <div className="relative w-full sm:w-auto sm:flex-grow max-w-xs">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input 
                              placeholder="Filter by name..."
                              value={filterQuery}
                              onChange={(e) => setFilterQuery(e.target.value)}
                              className="pl-10"
                          />
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4 w-full sm:w-auto">
                           <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                  variant={"outline"}
                                  onClick={handleScanButtonClick}
                                >
                                  <ScanLine className="mr-2 h-4 w-4" />
                                  {getScanButtonLabel()}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Use your device's camera to scan and pick items from the list.</p>
                            </TooltipContent>
                          </Tooltip>
                          <Select value={sortConfig} onValueChange={setSortConfig}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <SelectTrigger className="w-full sm:w-[200px]">
                                      <SelectValue placeholder="Sort by..." />
                                  </SelectTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Change the sort order of the product list.</p>
                                </TooltipContent>
                              </Tooltip>
                              <SelectContent>
                                  <SelectItem value="walkSequence-asc">Pick Walk</SelectItem>
                                  <SelectItem value="stockQuantity-desc">Stock (High to Low)</SelectItem>
                                  <SelectItem value="stockQuantity-asc">Stock (Low to High)</SelectItem>
                                  <SelectItem value="price-desc">Price (High to Low)</SelectItem>
                                  <SelectItem value="price-asc">Price (Low to High)</SelectItem>
                                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                              </SelectContent>
                          </Select>
                           <Tooltip>
                            <TooltipTrigger asChild>
                               <Button variant="outline" onClick={handleOpenExportModal}>
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Export
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Share this list with another device via a link or QR code.</p>
                            </TooltipContent>
                          </Tooltip>
                          <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant={layout === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setLayout('grid')}>
                                      <LayoutGrid className="h-5 w-5"/>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Grid View</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant={layout === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setLayout('list')}>
                                      <List className="h-5 w-5"/>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>List View</p>
                                </TooltipContent>
                              </Tooltip>
                          </div>
                           <AlertDialog>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon">
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Clear all items from the list.</p>
                                </TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action will permanently clear your entire picking list. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleResetList}>Clear List</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                      </div>
                  </div>
              </div>
          }

          {isLoading && products.length === 0 ? (
            <div className={`gap-6 ${layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col'}`}>
                {skeletons}
            </div>
          ) : sortedAndFilteredProducts.length > 0 || loadingSkuCount > 0 ? (
            <div className={`gap-6 ${layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col'}`}>
              {sortedAndFilteredProducts.map((product) => (
                <ProductCard key={product.sku} product={product} layout={layout} onPick={() => handlePick(product.sku)} isPicker />
              ))}
              {isLoading && skeletons}
            </div>
          ) : !isLoading && products.length > 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                  <p>No products match your filter.</p>
              </div>
          ) : !isLoading && form.formState.isSubmitted ? (
              <div className="text-center py-16 text-muted-foreground">
                  <PackageSearch className="mx-auto h-16 w-16 mb-4" />
                  <h3 className="text-xl font-semibold">No Products Found</h3>
                  <p>We couldn't find any products for the SKUs you entered.</p>
              </div>
          ) : null}
        </TooltipProvider>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PickingList />
    </Suspense>
  );
}
