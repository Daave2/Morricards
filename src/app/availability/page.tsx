
'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { type Html5QrcodeScanner } from 'html5-qrcode';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useAudioFeedback } from '@/hooks/use-audio-feedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, PackageSearch, Search, ScanLine, Link as LinkIcon, ServerCrash, Trash2, LayoutGrid, List } from 'lucide-react';
import ProductCard from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
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

type Product = FetchMorrisonsDataOutput[0];

const FormSchema = z.object({
  skus: z.string().min(1, { message: 'Please enter at least one SKU.' }),
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
});

const SCANNER_CONTAINER_ID = 'qr-reader';

export default function AvailabilityPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [isScanMode, setIsScanMode] = useState(false);
  const { toast } = useToast();
  const { playSuccess, playInfo } = useAudioFeedback();

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannedSkusRef = useRef<Set<string>>(new Set());

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      skus: '',
      locationId: '218',
    },
  });

  const stopScanner = () => {
    if (scannerRef.current) {
        try {
            scannerRef.current.clear();
        } catch (error) {
            console.warn("Ignoring error during scanner cleanup:", error);
        } finally {
            scannerRef.current = null;
        }
    }
  };

  useEffect(() => {
    if (isScanMode) {
      import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
        const onScanSuccess = (decodedText: string) => {
          if (!decodedText || scannedSkusRef.current.has(decodedText)) return;
          
          scannedSkusRef.current.add(decodedText);
          
          const currentSkus = form.getValues('skus');
          if (currentSkus.split(/[\s,]+/).find(s => s.trim() === decodedText)) {
            playInfo();
            toast({ title: 'EAN Already in List', description: `EAN ${decodedText} is already in the text box.` });
          } else {
            form.setValue('skus', currentSkus ? `${currentSkus}, ${decodedText}` : decodedText, { shouldValidate: true });
            playSuccess();
            toast({ title: 'Barcode Scanned', description: `Added EAN: ${decodedText}` });
          }
          
          setTimeout(() => {
            scannedSkusRef.current.delete(decodedText);
          }, 3000); 
        };

        const onScanFailure = (error: any) => {};
        
        if (!scannerRef.current) {
            scannerRef.current = new Html5QrcodeScanner(
              SCANNER_CONTAINER_ID,
              { 
                fps: 10,
                qrbox: { width: 250, height: 100 },
                rememberLastUsedCamera: true,
                supportedScanTypes: [],
              },
              false
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanMode]);

  async function onSubmit(values: z.infer<typeof FormSchema>) {
    setIsLoading(true);
    setProducts([]); // Clear previous results
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
      } else {
        setProducts(data);
      }
    }
    setIsLoading(false);
    if (isScanMode) setIsScanMode(false);
  }

  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      p.name.toLowerCase().includes(filterQuery.toLowerCase())
    );
  }, [products, filterQuery]);

  const handleScanButtonClick = () => {
    if (isScanMode) {
      setIsScanMode(false);
    } else {
      scannedSkusRef.current = new Set();
      setIsScanMode(true);
    }
  }

  const handleReset = () => {
    setProducts([]);
    setFilterQuery('');
    form.reset();
    toast({
        title: 'Form Cleared',
        description: 'The form and results have been cleared.',
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
               <ServerCrash className="w-12 h-12 text-primary" />
              <h1 className="text-5xl font-bold tracking-tight text-primary">
                Availability <span className="text-foreground">Check</span>
              </h1>
            </div>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Quickly check stock and price information for one or more products.
            </p>
             <Button variant="link" asChild className="mt-2">
                <Link href="/">
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Go to Picking List
                </Link>
            </Button>
          </header>
          
          <Card className="max-w-4xl mx-auto mb-12 shadow-lg">
            <CardHeader>
              <CardTitle>Check Product Availability</CardTitle>
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
                            {isScanMode ? 'Close Scanner' : 'Scan to Add'}
                          </Button>
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder="Scan barcodes or enter SKUs separated by commas, spaces, or new lines..."
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
                      'Check Availability'
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
                           <Button variant="outline" size="sm">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Clear
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will clear the form and all results.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleReset}>Clear</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  </div>
              </div>
          }

          {isLoading ? (
            <div className={`gap-6 ${layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col'}`}>
              {Array.from({ length: 4 }).map((_, i) => (
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
          ) : filteredProducts.length > 0 ? (
            <div className={`gap-6 ${layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col'}`}>
              {filteredProducts.map((product) => (
                <ProductCard key={product.sku} product={product} layout={layout} />
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
