
'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { type Html5QrcodeScanner, type Html5Qrcode } from 'html5-qrcode';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useAudioFeedback } from '@/hooks/use-audio-feedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PackageSearch, Search, ShoppingBasket, LayoutGrid, List, ScanLine, X, Check, Info, Undo2, Trash2 } from 'lucide-react';
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

type Product = FetchMorrisonsDataOutput[0] & { picked?: boolean };

const FormSchema = z.object({
  skus: z.string().min(1, { message: 'Please enter at least one SKU.' }),
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
});

const LOCAL_STORAGE_KEY = 'morricards-products';
const SCANNER_CONTAINER_ID = 'qr-reader';

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<string>('walkSequence-asc');
  const [filterQuery, setFilterQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [isScanMode, setIsScanMode] = useState(false);
  const { toast, dismiss } = useToast();
  const { playSuccess, playError, playInfo } = useAudioFeedback();

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannedSkusRef = useRef<Set<string>>(new Set());

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
  }, [toast]);

  const handlePick = useCallback((sku: string) => {
    const productCard = document.querySelector(`[data-sku="${sku}"]`);
    if (productCard) {
        productCard.classList.add('picked-animation');
    }

    requestAnimationFrame(() => {
        setProducts(prevProducts => {
            const productToUpdate = prevProducts.find(p => p.sku === sku || p.scannedSku === sku);
            if (!productToUpdate) return prevProducts;

            const isPicking = !productToUpdate.picked;
            
            if (isPicking) {
                // We show toast feedback outside of the state update to avoid delays
            }

            const updatedProducts = prevProducts.map(p => (p.sku === sku || p.scannedSku === sku) ? { ...p, picked: !p.picked } : p);
            return [...updatedProducts];
        });
    });

    // Provide immediate feedback, not tied to the state update
    const productToUpdate = products.find(p => p.sku === sku || p.scannedSku === sku);
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

  }, [products, handleUndoPick, playSuccess, dismiss, toast]);
  
   const stopScanner = async () => {
    if (scannerRef.current) {
        const scanner = scannerRef.current as any;
        try {
            if (scanner.getState() === 2) { // 2 === Html5QrcodeScannerState.SCANNING
                await scanner.stop();
            }
            await scanner.clear();
        } catch (error) {
            console.error("Failed to stop or clear html5-qrcode-scanner.", error);
        } finally {
            scannerRef.current = null;
        }
    }
  };

   useEffect(() => {
    if (isScanMode) {
      // Dynamically import the library
      import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
        const onScanSuccess = (decodedText: string) => {
          if (!decodedText || scannedSkusRef.current.has(decodedText)) return;
          
          scannedSkusRef.current.add(decodedText);

          const productToPick = products.find(p => p.sku === decodedText || p.scannedSku === decodedText);
          if (productToPick) {
            if (productToPick.picked) {
              playInfo();
              toast({ title: 'Item Already Picked', description: `Already picked: ${productToPick.name}`, icon: <Info className="h-5 w-5 text-blue-500" /> });
            } else {
              handlePick(productToPick.sku);
            }
          } else {
              const currentSkus = form.getValues('skus');
              if (currentSkus.split(/[\s,]+/).find(s => s.trim() === decodedText)) {
                playInfo();
                toast({ title: 'EAN Already in List', description: `EAN ${decodedText} is already in the text box.` });
              } else {
                form.setValue('skus', currentSkus ? `${currentSkus}, ${decodedText}` : decodedText, { shouldValidate: true });
                playSuccess();
                toast({ title: 'Barcode Scanned', description: `Added EAN: ${decodedText}` });
              }
          }
           // After a short delay, allow the same barcode to be scanned again if needed.
          setTimeout(() => {
            scannedSkusRef.current.delete(decodedText);
          }, 1500); // Increased delay slightly
        };

        const onScanFailure = (error: any) => {
          // We can ignore errors, as they happen continuously when no code is found.
        };
        
        if (!scannerRef.current) {
            scannerRef.current = new Html5QrcodeScanner(
              SCANNER_CONTAINER_ID,
              { 
                fps: 10,
                qrbox: { width: 250, height: 100 },
                rememberLastUsedCamera: true,
                supportedScanTypes: [], // Scan all supported types
              },
              /* verbose= */ false
            );
        }

        scannerRef.current.render(onScanSuccess, onScanFailure);

      }).catch(err => {
        console.error("Failed to load html5-qrcode library", err);
      });

    } else {
        stopScanner();
    }

    return () => {
        stopScanner();
    };
  }, [isScanMode, handlePick, playInfo, playSuccess, toast, form]);


  async function onSubmit(values: z.infer<typeof FormSchema>) {
    setIsLoading(true);
    // Don't clear products here to allow adding to existing list
    const { data, error } = await getProductData(values);

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
        // Merge new products with existing ones, avoiding duplicates
        setProducts(prevProducts => {
            const existingSkus = new Set(prevProducts.map(p => p.sku));
            const newProducts = data.filter(p => !existingSkus.has(p.sku));
            return [...prevProducts, ...newProducts.map(p => ({ ...p, picked: false }))]
        });
        form.setValue('skus', ''); // Clear SKU input after successful fetch
      }
    }
    setIsLoading(false);
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
    if (isScanMode) {
      setIsScanMode(false);
    } else {
      scannedSkusRef.current = new Set(); // Reset session scanned SKUs
      setIsScanMode(true);
    }
  }

  const getScanButtonLabel = () => {
    if (isScanMode) return 'Close Scanner';
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

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:py-12">
        {isScanMode && (
          <div className="sticky top-0 z-50 py-4 bg-background -mx-4 px-4 mb-4">
            <div className="max-w-md mx-auto rounded-lg overflow-hidden shadow-lg border h-[200px] flex items-center justify-center bg-black [&>span]:hidden">
              <div id={SCANNER_CONTAINER_ID} className="w-[350px] h-[350px]"></div>
            </div>
          </div>
        )}
        <div className={isScanMode ? 'pt-4' : ''}>
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
                            variant={isScanMode ? 'destructive' : 'outline'}
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
                  <div className="flex flex-wrap gap-4 justify-between items-center">
                      <div className="relative w-full sm:w-auto sm:flex-grow max-w-xs">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input 
                              placeholder="Filter by name..."
                              value={filterQuery}
                              onChange={(e) => setFilterQuery(e.target.value)}
                              className="pl-10"
                          />
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                          <Button 
                              variant={isScanMode ? "destructive" : "outline"}
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

          {isLoading ? (
            <div className={`gap-6 ${layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col'}`}>
              {Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="w-full">
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
              ))}
            </div>
          ) : sortedAndFilteredProducts.length > 0 ? (
            <div className={`gap-6 ${layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col'}`}>
              {sortedAndFilteredProducts.map((product) => (
                <ProductCard key={product.sku} product={product} layout={layout} onPick={() => handlePick(product.sku)} />
              ))}
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
}
