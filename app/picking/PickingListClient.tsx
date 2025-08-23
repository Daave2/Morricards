

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
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PackageSearch, Search, ShoppingBasket, LayoutGrid, List, ScanLine, X, Check, Info, Undo2, Trash2, Link as LinkIcon, CameraOff, Zap, Share2, Copy, Settings, WifiOff, Wifi, RefreshCw, Bolt, Bot, Map, ScanSearch, AlertTriangle, ChevronsUpDown, DownloadCloud } from 'lucide-react';
import ProductCard from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ToastAction } from '@/components/ui/toast';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import Link from 'next/link';
import SearchComponent from '@/components/assistant/Search';
import type { SearchHit } from '@/lib/morrisonsSearch';
import { Separator } from '@/components/ui/separator';


type Product = FetchMorrisonsDataOutput[0] & { picked?: boolean; isOffline?: boolean; };

type ScanMode = 'off' | 'add' | 'pick';

const FormSchema = z.object({
  skus: z.string().optional(),
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
  pickSku: z.string().optional(),
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
                  <RefreshCw className="h-4 w-4" />
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


export default function PickingListClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [loadingSkuCount, setLoadingSkuCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<string>('walkSequence-asc');
  const [filterQuery, setFilterQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [scanMode, setScanMode] = useState<ScanMode>('off');
  const [isSpeedMode, setIsSpeedMode] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [exportUrl, setExportUrl] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [consecutiveFails, setConsecutiveFails] = useState(0);
  
  const { toast, dismiss } = useToast();
  const { playSuccess, playError, playInfo } = useAudioFeedback();
  const { settings, fetchAndUpdateToken } = useApiSettings();
  const { isOnline, syncedItems } = useNetworkSync();

  const productsRef = useRef(products);
  const scannerRef = useRef<{ start: () => void; stop: () => void; getOcrDataUri: () => string | null; } | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  const startScannerWithDelay = useCallback(() => {
    setTimeout(() => {
        if (scanMode !== 'off' && scannerRef.current) {
            scannerRef.current.start();
        }
    }, 1500); // 1.5 second delay
  }, [scanMode]);

  useEffect(() => {
    if (scanMode !== 'off') {
      scannerRef.current?.start();
    } else {
      scannerRef.current?.stop();
    }
  }, [scanMode]);

  // Keep the ref updated with the latest products state
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // Load products from local storage on initial render
  useEffect(() => {
    try {
      const savedProducts = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedProducts) {
        const parsedProducts = JSON.parse(savedProducts);
        setProducts(parsedProducts);
        // Set initial state of add form based on whether there are products
        if (parsedProducts.length === 0) {
            setIsAddFormOpen(true);
        }
      } else {
        // If no saved products, list is blank, so open the form
        setIsAddFormOpen(true);
      }
    } catch (error) {
      console.error("Failed to load products from local storage", error);
      setIsAddFormOpen(true); // Open form on error as well
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
      pickSku: '',
    },
  });

  const skusFromUrl = searchParams.get('skus');
  const locationFromUrl = searchParams.get('location');

  // Handle dynamic links
  useEffect(() => {
    if (skusFromUrl && locationFromUrl) {
      form.setValue('skus', skusFromUrl);
      form.setValue('locationId', locationFromUrl);
      onSubmit({ skus: skusFromUrl, locationId: locationFromUrl, pickSku: '' });
      
      // Clean the URL to avoid re-triggering on refresh
      router.replace('/picking', undefined);
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
    const productToUpdate = productsRef.current.find(p => p.sku === sku);

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
  
  const handleScanToPick = useCallback((text: string) => {
    const scannedValue = text.split(',')[0].trim();
    if (!scannedValue) return;

    if (!isSpeedMode) {
        setScanMode('off');
    }

    const productToPick = productsRef.current.find(p => 
        p.sku === scannedValue || 
        p.scannedSku === scannedValue || 
        p.primaryEan13 === scannedValue
    );

    if (productToPick) {
        if (productToPick.picked) {
            playInfo();
            toast({ title: 'Item Already Picked', description: `Already picked: ${productToPick.name}`, icon: <Info className="h-5 w-5 text-blue-500" /> });
        } else {
            handlePick(productToPick.sku);
        }
    } else {
        playError();
        toast({
            variant: 'destructive',
            title: 'Item Not on List',
            description: `SKU ${scannedValue} is not on your current picking list.`,
            icon: <AlertTriangle className="h-5 w-5" />
        });
    }

    if (isSpeedMode) {
        startScannerWithDelay();
    }
  }, [handlePick, playInfo, playError, toast, isSpeedMode, startScannerWithDelay]);

  const addSingleProduct = useCallback(async (sku: string) => {
    if (!sku || sku.length < 4) return;

    setScanMode('off');
    
    if (productsRef.current.some(p => p.sku === sku || p.scannedSku === sku || p.primaryEan13 === sku)) {
        playInfo();
        toast({ title: 'Item Already on List', description: 'This item is already on your picking list.', icon: <Info className="h-5 w-5 text-blue-500" /> });
        return;
    }

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
    if (error || !data || !data.length) {
        const errText = error || `Could not find product for EAN: ${sku}`;
        playError();
        const newFailCount = consecutiveFails + 1;
        setConsecutiveFails(newFailCount);

        let toastAction: React.ReactElement | undefined = (
            <ToastAction altText="Copy" onClick={() => navigator.clipboard.writeText(errText)}>
                <Copy className="mr-2 h-4 w-4" /> Copy
            </ToastAction>
        );

        if (newFailCount >= 2 && settings.debugMode) {
            toastAction = (
                <ToastAction altText="Fetch Latest?" onClick={fetchAndUpdateToken}>
                     <DownloadCloud className="mr-2 h-4 w-4" />
                     Fetch Latest?
                </ToastAction>
            )
        }
        
        toast({
            variant: 'destructive',
            title: 'Product Not Found',
            description: settings.debugMode && newFailCount >= 2 ? "Lookup failed again. Your token may have expired." : errText,
            action: toastAction
        });
    } else {
        setConsecutiveFails(0); // Reset on success
        const newProducts = data.map(p => ({ ...p, picked: false }));
        setProducts(prevProducts => {
            const updatedExistingSkus = new Set(prevProducts.map(p => p.sku));
            const uniqueNewProducts = newProducts.filter(p => !updatedExistingSkus.has(p.sku));
            return [...prevProducts, ...uniqueNewProducts];
        });
        // Check for individual item errors in debug mode
        if (settings.debugMode) {
          newProducts.forEach(p => {
            if (p.proxyError) {
              toast({ variant: 'destructive', title: `Error for ${p.sku}`, description: p.proxyError, duration: 10000 });
            }
          });
        }
    }
    
    setIsLoading(false);
    setLoadingSkuCount(prev => Math.max(0, prev - 1));

  }, [form, settings.bearerToken, settings.debugMode, isOnline, playInfo, playSuccess, playError, toast, consecutiveFails, fetchAndUpdateToken]);

  const handleScanToAdd = useCallback(async (text: string) => {
    const sku = text.split(',')[0].trim();
    await addSingleProduct(sku);
  }, [addSingleProduct]);

  const handleSearchPick = useCallback((hit: SearchHit) => {
    if (hit.retailerProductId) {
      addSingleProduct(hit.retailerProductId);
    } else {
      toast({
        variant: 'destructive',
        title: 'Selection Error',
        description: 'The selected product does not have a valid ID to look up.'
      });
    }
  }, [addSingleProduct, toast]);


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

  const handleOcrRequest = async () => {
    if (!scannerRef.current) return;
    const imageDataUri = scannerRef.current.getOcrDataUri();
    if (!imageDataUri) return;

    setIsOcrLoading(true);
    toast({ title: 'AI OCR', description: 'Reading numbers from the label...' });
    try {
        const result = await ocrFlow({ imageDataUri });
        if (result.eanOrSku) {
            toast({ title: 'AI OCR Success', description: `Found number: ${result.eanOrSku}` });
            if (scanMode === 'add') {
                await handleScanToAdd(result.eanOrSku);
            } else if (scanMode === 'pick') {
                handleScanToPick(result.eanOrSku);
            }
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
  
  const handlePickSubmit = (values: z.infer<typeof FormSchema>) => {
    const skuToPick = values.pickSku;
    if (skuToPick) {
      handleScanToPick(skuToPick); // Re-use the same logic as scanning
      form.setValue('pickSku', ''); // Clear the input after submission
    }
  };

  async function onSubmit(values: z.infer<typeof FormSchema>) {
    const existingSkus = new Set(products.map(p => p.sku));
    const newSkus = (values.skus || '')
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(s => s && s.length >= 4 && !existingSkus.has(s));

    if (newSkus.length === 0) {
      toast({
        title: 'No new SKUs to add',
        description: 'All entered SKUs are either invalid, too short, or already in the list.',
      });
      return;
    }
    
    setLoadingSkuCount(newSkus.length);
    setIsLoading(true);
    setIsFetching(true);
    setIsAddFormOpen(false); // Close form on submit

    const { data, error } = await getProductData({
      ...values,
      skus: newSkus,
      bearerToken: settings.bearerToken,
      debugMode: settings.debugMode,
    });

    setIsFetching(false);
    if (error) {
      const newFailCount = consecutiveFails + 1;
      setConsecutiveFails(newFailCount);
       let toastAction: React.ReactElement | undefined = (
            <ToastAction altText="Copy" onClick={() => navigator.clipboard.writeText(error)}>
                <Copy className="mr-2 h-4 w-4" /> Copy
            </ToastAction>
        );

        if (newFailCount >= 2 && settings.debugMode) {
            toastAction = (
                <ToastAction altText="Fetch Latest?" onClick={fetchAndUpdateToken}>
                     <DownloadCloud className="mr-2 h-4 w-4" />
                     Fetch Latest?
                </ToastAction>
            )
        }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: settings.debugMode && newFailCount >= 2 ? "Lookup failed again. Your token may have expired." : error,
        duration: 15000,
        action: toastAction,
      });
    } else if (data) {
       setConsecutiveFails(0); // Reset on success
       if (data.length === 0) {
        toast({
          title: 'No new products found',
          description: 'Could not find any products for the given SKUs.',
        });
      } else {
        const newProducts = data.map(p => ({ ...p, picked: false }));
        setProducts(prevProducts => {
            const updatedExistingSkus = new Set(prevProducts.map(p => p.sku));
            const uniqueNewProducts = newProducts.filter(p => !updatedExistingSkus.has(p.sku));
            return [...prevProducts, ...uniqueNewProducts];
        });
        form.setValue('skus', '');
        // Check for individual item errors in debug mode
        if (settings.debugMode) {
          newProducts.forEach(p => {
            if (p.proxyError) {
              toast({ variant: 'destructive', title: `Error for ${p.sku}`, description: p.proxyError, duration: 10000 });
            }
          });
        }
      }
    }
    setIsLoading(false);
    setLoadingSkuCount(0);
    setScanMode('off');
  }

  const sortedAndFilteredProducts = useMemo(() => {
    let result: Product[] = [...products].filter((p) =>
      p.name.toLowerCase().includes(filterQuery.toLowerCase())
    );

    const [key, direction] = sortConfig.split('-');
    
    result.sort((a, b) => {
      if (a.picked && !b.picked) return 1;
      if (!a.picked && b.picked) return -1;
      
      let valA: any = a[key as keyof Product];
      let valB: any = b[key as keyof Product];

      if (key === 'price' && valA && valB) {
        valA = (valA as {regular?: number}).regular;
        valB = (valB as {regular?: number}).regular;
      }
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (key === 'walkSequence') {
        valA = Number(a.productDetails.legacyItemNumbers) || Infinity;
        valB = Number(b.productDetails.legacyItemNumbers) || Infinity;
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

  const handleResetList = () => {
    setProducts([]);
    setFilterQuery('');
    setSortConfig('walkSequence-asc');
    form.reset({skus: '', locationId: form.getValues('locationId'), pickSku: ''});
    setIsAddFormOpen(true); // Open form when list is cleared
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
    const url = `${window.location.origin}/picking?skus=${encodeURIComponent(skus)}&location=${encodeURIComponent(locationId)}`;
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
    <div className="min-h-screen">
      <InstallPrompt />
      {scanMode === 'add' && (
         <div className={cn(
            "fixed inset-0 z-50 flex flex-col items-center justify-center p-4",
            "bg-background/90 backdrop-blur-sm",
            "theme-glass:bg-black/10 theme-glass:backdrop-blur-xl"
         )}>
            <div className="w-full max-w-md mx-auto relative p-0 space-y-4">
                <ZXingScanner 
                    ref={scannerRef} 
                    onResult={handleScanToAdd} 
                    onError={handleScanError}
                />
            </div>
             <div className="mt-4 w-full max-w-md">
                <Button onClick={handleOcrRequest} disabled={isOcrLoading} className="w-full" size="lg">
                    {isOcrLoading ? ( <Loader2 className="animate-spin" /> ) : ( <ScanSearch /> )}
                    {isOcrLoading ? 'Reading...' : 'Read with AI'}
                </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setScanMode('off')} className="absolute top-4 right-4 z-10 bg-black/20 hover:bg-black/50 text-white hover:text-white">
               <X className="h-6 w-6" />
            </Button>
        </div>
      )}

      {scanMode === 'pick' && (
        <div className={cn(
            "sticky top-0 z-40 p-2 shadow-md",
            "bg-background/95 backdrop-blur-sm border-b",
            "theme-glass:bg-black/10 theme-glass:backdrop-blur-xl"
        )}>
             <div className="w-full max-w-sm mx-auto">
                <div className="relative aspect-[4/3] w-full rounded-md overflow-hidden">
                    <ZXingScanner
                        ref={scannerRef}
                        onResult={handleScanToPick}
                        onError={handleScanError}
                    />
                </div>
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
          <div className='flex justify-end mb-4'>
             <StatusIndicator isFetching={isFetching} />
          </div>
          <Collapsible open={isAddFormOpen} onOpenChange={setIsAddFormOpen} className="max-w-4xl mx-auto mb-12">
            <Card>
                <CollapsibleTrigger asChild>
                    <div className='flex items-center justify-between p-6 cursor-pointer'>
                        <CardTitle>Create or Add to Picking List</CardTitle>
                        <Button variant="ghost" size="icon">
                            <ChevronsUpDown className="h-5 w-5" />
                            <span className="sr-only">Toggle Add to List Form</span>
                        </Button>
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent>
                      <Form {...form}>
                        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
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
                          <div className='space-y-4'>
                            <SearchComponent onPick={handleSearchPick} />
                            <Button
                                type="button"
                                className="w-full"
                                onClick={() => setScanMode('add')}
                                disabled={isLoading}
                                variant='outline'
                                >
                                <ScanLine className="mr-2 h-4 w-4" />
                                Or Scan to Add
                            </Button>
                          </div>
                          <Separator />
                          <FormField
                              control={form.control}
                              name="skus"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Bulk Add</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Or paste a list of SKUs/EANs, separated by spaces or commas..."
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button type="button" onClick={form.handleSubmit(onSubmit)} className="w-full" disabled={isLoading}>
                              {isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <PackageSearch className="mr-2 h-4 w-4" />
                              )}
                              Add to List
                            </Button>
                        </form>
                      </Form>
                    </CardContent>
                </CollapsibleContent>
            </Card>
          </Collapsible>
           
          { (products.length > 0 || isLoading) && 
              <div className="mb-8 p-4 rounded-lg shadow-md">
                  <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                      <div className="relative w-full sm:w-auto sm:flex-grow max-w-xs">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input 
                              placeholder="Filter by name..."
                              value={filterQuery}
                              onChange={(e) => setFilterQuery(e.target.value)}
                              className="pl-10"
                          />
                          {filterQuery && (
                            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setFilterQuery('')}>
                                <X className="h-4 w-4" />
                            </Button>
                          )}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                          <Form {...form}>
                            <form onSubmit={form.handleSubmit(handlePickSubmit)} className="flex items-center gap-2">
                                <FormField
                                    control={form.control}
                                    name="pickSku"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                               <Input placeholder="Pick by SKU..." {...field} className="h-9 w-32" />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button type="submit" size="icon" className="h-9 w-9">
                                            <Check className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Manually pick an item by SKU/EAN.</p></TooltipContent>
                                </Tooltip>
                            </form>
                          </Form>
                           <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                  variant={"outline"}
                                  onClick={() => setScanMode(scanMode === 'pick' ? 'off' : 'pick')}
                                  data-active={scanMode === 'pick'}
                                  className="data-[active=true]:ring-2 data-[active=true]:ring-primary h-9 w-9"
                                  size="icon"
                                >
                                  <ScanLine className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Use your device's camera to scan and pick items from the list.</p>
                            </TooltipContent>
                           </Tooltip>
                          <div className="flex items-center gap-1">
                            <Select value={sortConfig} onValueChange={setSortConfig}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <SelectTrigger className="w-full sm:w-[150px]">
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
                            <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant={layout === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setLayout('grid')} className="h-8 w-8">
                                        <LayoutGrid className="h-5 w-5"/>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Grid View</p>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant={layout === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setLayout('list')} className="h-8 w-8">
                                        <List className="h-5 w-5"/>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>List View</p>
                                  </TooltipContent>
                                </Tooltip>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <Tooltip>
                              <TooltipTrigger asChild>
                                 <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleOpenExportModal}>
                                      <Share2 className="h-4 w-4" />
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Share this list with another device via a link or QR code.</p>
                              </TooltipContent>
                            </Tooltip>
                             <AlertDialog>
                              <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="icon" className="h-9 w-9">
                                          <Trash2 className="h-4 w-4" />
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
                   <div className="flex items-center space-x-2 justify-center pt-4">
                    <Switch id="speed-mode" checked={isSpeedMode} onCheckedChange={setIsSpeedMode} />
                    <Label htmlFor="speed-mode" className="flex items-center gap-2">
                        <Bolt className={cn("h-4 w-4 transition-colors", isSpeedMode ? "text-primary" : "text-muted-foreground")} />
                        Speed Mode (Scan to Pick)
                    </Label>
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
                <ProductCard key={product.sku} product={product} layout={layout} onPick={() => handlePick(product.sku)} isPicker locationId={form.getValues('locationId')} />
              ))}
              {isLoading && skeletons}
            </div>
          ) : !isLoading && products.length > 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                    <PackageSearch className="mx-auto h-16 w-16 mb-4" />
                    <h3 className="text-xl font-semibold text-foreground">No Matches Found</h3>
                    <p>No products in your list match the filter "{filterQuery}".</p>
                    <Button variant="link" onClick={() => setFilterQuery('')}>Clear filter</Button>
                </CardContent>
              </Card>
          ) : !isLoading && form.formState.isSubmitted ? (
               <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                    <PackageSearch className="mx-auto h-16 w-16 mb-4" />
                    <h3 className="text-xl font-semibold text-foreground">No Products Found</h3>
                    <p>We couldn't find any products for the SKUs you entered.</p>
                </CardContent>
              </Card>
          ) : null}
        </TooltipProvider>
      </main>
    </div>
  );
}

