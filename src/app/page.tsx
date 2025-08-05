
'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
import { Loader2, PackageSearch, Search, ShoppingBasket, LayoutGrid, List, ScanLine, X, Check, Info, Undo2, Trash2, Link as LinkIcon, CameraOff, Zap } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import ZXingScanner from '@/components/ZXingScanner';

type Product = FetchMorrisonsDataOutput[0] & { picked?: boolean };

const FormSchema = z.object({
  skus: z.string().min(1, { message: 'Please enter at least one SKU.' }),
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
});

const LOCAL_STORAGE_KEY = 'morricards-products';

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSkuCount, setLoadingSkuCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<string>('walkSequence-asc');
  const [filterQuery, setFilterQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [isScanMode, setIsScanMode] = useState(false);
  
  const { toast, dismiss } = useToast();
  const { playSuccess, playError, playInfo } = useAudioFeedback();

  const productsRef = useRef(products);
  const scannerRef = useRef<{ start: () => void } | null>(null);

  useEffect(() => {
    if (isScanMode) {
      scannerRef.current?.start();
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
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(products));
    } catch (error) {
      console.error("Failed to save products to local storage", error);
    }
  }, [products]);


  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      skus: '',
      locationId: '218',
    },
  });
  
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
    if (productCard) {
        productCard.classList.add('picked-animation');
    }

    requestAnimationFrame(() => {
        setProducts(prevProducts => {
            const productToUpdate = prevProducts.find(p => p.sku === sku || p.scannedSku === sku);
            if (!productToUpdate) return prevProducts;
            const updatedProducts = prevProducts.map(p => (p.sku === sku || p.scannedSku === sku) ? { ...p, picked: !p.picked } : p);
            return [...updatedProducts];
        });
    });

    const productToUpdate = productsRef.current.find(p => p.sku === sku || p.scannedSku === sku);
    if(productToUpdate && !productToUpdate.picked) {
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleScanResult = useCallback(async (text: string) => {
    const sku = text.split(',')[0].trim();
    if (!sku) return;

    const productToPick = productsRef.current.find(p => p.sku === sku || p.scannedSku === sku);

    if (productToPick) {
        if (productToPick.picked) {
            playInfo();
            toast({ title: 'Item Already Picked', description: `Already picked: ${productToPick.name}`, icon: <Info className="h-5 w-5 text-blue-500" /> });
        } else {
            handlePick(productToPick.sku);
        }
    } else {
        playSuccess();
        toast({ title: 'New Item Scanned', description: `Fetching details for EAN: ${sku}` });

        setLoadingSkuCount(prev => prev + 1);
        setIsLoading(true);

        const locationId = form.getValues('locationId');
        const { data, error } = await getProductData({ locationId, skus: [sku] });
        
        if (error || !data || data.length === 0) {
            playError();
            toast({ variant: 'destructive', title: 'Product Not Found', description: `Could not find product for EAN: ${sku}` });
        } else {
            setProducts(prevProducts => {
                const existing = prevProducts.find(p => p.sku === data[0].sku);
                if (existing) return prevProducts; // Already added somehow
                return [...prevProducts, { ...data[0], picked: false }];
            });
        }
        
        setIsLoading(false);
        setLoadingSkuCount(prev => Math.max(0, prev - 1));
    }

    // Restart scanning after a short delay
    setTimeout(() => {
        if (scannerRef.current) { // Check if the ref is still mounted and scanner is active
          scannerRef.current?.start();
        }
    }, 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlePick, playInfo, playSuccess, toast, playError, form]);

  const handleScanError = (message: string) => {
    if (!message.toLowerCase().includes('not found')) {
      toast({
        variant: 'destructive',
        title: 'Scanner Error',
        description: message,
      });
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

    const { data, error } = await getProductData({...values, skus: newSkus});

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error,
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
      {isScanMode && (
         <div className="fixed inset-x-0 top-0 z-50 bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-md mx-auto relative p-0">
                <ZXingScanner 
                    ref={scannerRef} 
                    onResult={handleScanResult} 
                    onError={handleScanError} 
                />
                <Button variant="ghost" size="icon" onClick={() => setIsScanMode(false)} className="absolute top-2 right-2 z-10 bg-black/20 hover:bg-black/50 text-white hover:text-white">
                   <X className="h-5 w-5" />
                </Button>
            </div>
        </div>
      )}
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div>
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-4">
               <ShoppingBasket className="w-12 h-12 text-primary" />
              <h1 className="text-5xl font-bold tracking-tight text-primary">
                Store mobile <span className="text-foreground">ULTRA</span>
              </h1>
            </div>
             <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Your friendly shopping assistant. Scan EANs or enter SKUs to build your picking list.
            </p>
            <Button variant="link" asChild className="mt-2">
                <Link href="/availability">
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Go to Availability Checker
                </Link>
            </Button>
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
                          <Button
                            type="button"
                            variant='outline'
                            size="sm"
                            onClick={handleScanButtonClick}
                          >
                            <ScanLine className="mr-2 h-4 w-4" />
                            {getScanButtonLabel()}
                          </Button>
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
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Fetching Data...
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
                          <Button 
                              variant={"outline"}
                              onClick={handleScanButtonClick}
                            >
                               <ScanLine className="mr-2 h-4 w-4" />
                               {getScanButtonLabel()}
                            </Button>
                          <Select value={sortConfig} onValueChange={setSortConfig}>
                              <SelectTrigger className="w-full sm:w-[200px]">
                                  <SelectValue placeholder="Sort by..." />
                              </SelectTrigger>
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
                              <Button variant={layout === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setLayout('grid')}>
                                  <LayoutGrid className="h-5 w-5"/>
                              </Button>
                              <Button variant={layout === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setLayout('list')}>
                                  <List className="h-5 w-5"/>
                              </Button>
                          </div>
                           <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon">
                                  <Trash2 className="h-5 w-5" />
                              </Button>
                            </AlertDialogTrigger>
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
        </div>
      </main>
    </div>
  );

    