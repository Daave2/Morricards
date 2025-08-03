'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PackageSearch, Search, ShoppingBasket, LayoutGrid, List, ScanLine, X, Check, Info } from 'lucide-react';
import ProductCard from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type Product = FetchMorrisonsDataOutput[0] & { picked?: boolean };

const FormSchema = z.object({
  skus: z.string().min(1, { message: 'Please enter at least one SKU.' }),
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
});

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<string>('walkSequence-asc');
  const [filterQuery, setFilterQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [isScanMode, setIsScanMode] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [scannedSkus, setScannedSkus] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>();
  const notFoundExceptionRef = useRef<any>(null);


  useEffect(() => {
    import('@zxing/library').then(ZXing => {
        codeReaderRef.current = new ZXing.BrowserMultiFormatReader();
        notFoundExceptionRef.current = ZXing.NotFoundException;
    });
  }, []);


  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      skus: '',
      locationId: '218',
    },
  });

  const stopCamera = useCallback(() => {
    if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
    }
  }, []);

  const handlePick = useCallback((sku: string) => {
    setProducts(prevProducts => {
        const productToUpdate = prevProducts.find(p => p.sku === sku || p.scannedSku === sku);
        if (!productToUpdate) return prevProducts;

        const updatedProducts = prevProducts.map(p => (p.sku === sku || p.scannedSku === sku) ? { ...p, picked: !p.picked } : p);
        return updatedProducts;
    });
  }, []);
  
  useEffect(() => {
    async function setupCamera() {
      if (isScanMode && codeReaderRef.current && notFoundExceptionRef.current) {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera not supported on this browser');
          }
          
          setHasCameraPermission(true);

          if (videoRef.current) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
              
              controlsRef.current = await codeReaderRef.current.decodeFromStream(stream, videoRef.current, (result, error, controls) => {
                  if (result) {
                      const code = result.getText();
                      if (scannedSkus.has(code)) { // Covers both list building and picking mode
                          return; 
                      }

                      // We add all scanned codes to a session set to avoid double-processing
                      setScannedSkus(prev => new Set(prev).add(code));

                      // If we have products, we are in "picking mode"
                      if (products.length > 0) {
                          const productToPick = products.find(p => p.sku === code || p.scannedSku === code);
                          if (productToPick) {
                              if (productToPick.picked) {
                                  toast({
                                      title: 'Item Already Picked',
                                      description: `Already picked: ${productToPick.name}`,
                                      icon: <Info className="h-5 w-5 text-accent" />
                                  });
                              } else {
                                handlePick(productToPick.sku);
                                toast({
                                    title: 'Item Picked',
                                    description: `Picked: ${productToPick.name}`,
                                    icon: <Check className="h-5 w-5 text-primary" />
                                });
                              }
                          } else {
                              toast({
                                  variant: 'destructive',
                                  title: 'Item Not in List',
                                  description: `Scanned item (EAN: ${code}) is not in the picking list.`,
                              });
                          }
                      } else {
                          // Otherwise, we are in "list building mode"
                          const currentSkus = form.getValues('skus');
                          form.setValue('skus', currentSkus ? `${currentSkus}, ${code}` : code, { shouldValidate: true });
                          toast({
                              title: 'Barcode Scanned',
                              description: `Added EAN: ${code}`,
                          });
                      }
                  }
                  if (error && !(error instanceof notFoundExceptionRef.current)) {
                      console.error('Barcode scan error:', error);
                  }
              });
            } catch (err) {
              console.error('Error initializing scanner:', err);
              setHasCameraPermission(false);
              setTimeout(() => toast({
                  variant: 'destructive',
                  title: 'Camera Access Denied',
                  description: 'Please enable camera permissions in your browser settings.',
              }), 0);
              setIsScanMode(false);
            }
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          setTimeout(() => toast({
            variant: 'destructive',
            title: 'Camera Access Error',
            description: (error as Error).message || 'Could not access camera.',
          }), 0);
          setIsScanMode(false);
        }
      } else {
        stopCamera();
      }
    }
    setupCamera();

    return () => {
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanMode, handlePick]);


  async function onSubmit(values: z.infer<typeof FormSchema>) {
    setIsLoading(true);
    setProducts([]);
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
          title: 'No products found',
          description: 'Could not find any products for the given SKUs.',
        });
      }
      setProducts(data.map(p => ({ ...p, picked: false })));
    }
    setIsLoading(false);
    // Reset session-specific scanned SKUs after list is built or scanner is closed
    if (isScanMode) setIsScanMode(false);
    setScannedSkus(new Set());
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
      setScannedSkus(new Set()); // Reset session scanned SKUs each time scanner is opened
      setIsScanMode(true);
    }
  }

  const getScanButtonLabel = () => {
    if (isScanMode) return 'Close Scanner';
    if (products.length > 0) return 'Pick by Scan';
    return 'Scan';
  }

  return (
    <div className="min-h-screen">
      {isScanMode && (
          <div className="sticky top-0 z-50 bg-black p-4 shadow-lg">
              <div className="relative w-full max-w-4xl mx-auto aspect-video rounded-lg overflow-hidden border-2 border-primary">
                  <video ref={videoRef} className="w-full h-full object-cover" />
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-3/4 h-1/2 border-y-2 border-dashed border-red-500 opacity-75" />
                  </div>
              </div>
              { hasCameraPermission === false && (
                <Alert variant="destructive" className="mt-4 max-w-4xl mx-auto">
                  <AlertTitle>Camera Access Required</AlertTitle>
                  <AlertDescription>
                    Please allow camera access in your browser settings to use the scanner.
                  </AlertDescription>
                </Alert>
              )}
          </div>
      )}
      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-4">
             <ShoppingBasket className="w-12 h-12 text-primary" />
            <h1 className="text-5xl font-bold tracking-tight text-primary">
              Store mobile<span className="text-foreground">ULTRA</span>
            </h1>
          </div>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Scan EANs or enter SKUs to build your picking list.
          </p>
        </header>

        <Card className="max-w-4xl mx-auto mb-12 shadow-lg">
          <CardHeader>
            <CardTitle>Create Picking List</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="skus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product SKUs / EANs</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Textarea
                            placeholder="Scan barcodes or enter SKUs separated by commas, spaces, or new lines... e.g. 369966011, 5010251674078"
                            className="min-h-[120px] resize-y pr-24"
                            {...field}
                          />
                          <Button 
                            type="button" 
                            variant={isScanMode ? "destructive" : "outline"}
                            className="absolute top-3 right-3"
                            onClick={handleScanButtonClick}
                          >
                             <ScanLine className="mr-2 h-4 w-4" />
                             {getScanButtonLabel()}
                          </Button>
                        </div>
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
                    'Get Picking List'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        { (products.length > 0 || isLoading) && 
            <div className="mb-8 p-4 bg-card rounded-lg shadow-md">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:w-auto md:flex-grow max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="Filter by name..."
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <Button 
                            variant={isScanMode ? "destructive" : "outline"}
                            onClick={handleScanButtonClick}
                          >
                             <ScanLine className="mr-2 h-4 w-4" />
                             {getScanButtonLabel()}
                          </Button>
                        <Select value={sortConfig} onValueChange={setSortConfig}>
                            <SelectTrigger className="w-[200px]">
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
      </main>
    </div>
  );
}
