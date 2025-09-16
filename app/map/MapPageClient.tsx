
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Map, Search, BrainCircuit, Copy, DownloadCloud, PackageSearch } from 'lucide-react';
import { useApiSettings } from '@/hooks/use-api-settings';
import StoreMap, { type ProductLocation } from '@/components/StoreMap';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { findAisleForProductTool } from '@/ai/flows/aisle-finder-flow';
import { ToastAction } from '@/components/ui/toast';
import SearchComponent from '@/components/assistant/Search';
import type { SearchHit } from '@/lib/morrisonsSearch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';


const AisleFormSchema = z.object({
  productCategory: z.string().min(2, { message: 'Please enter a product to find.' }),
});

type Product = FetchMorrisonsDataOutput[0];
type LocatedProduct = Product & { location: ProductLocation };

function parseLocationString(location: string | undefined): ProductLocation | null {
  if (!location) return null;

  const aisleRegex = /Aisle\s*(\d+)/i;
  const bayRegex = /bay\s*(\d+)/i;
  const sideRegex = /(Left|Right)/i;
  
  const aisleMatch = location.match(aisleRegex);
  const bayMatch = location.match(bayRegex);
  const sideMatch = location.match(sideRegex);

  if (aisleMatch && bayMatch && sideMatch) {
    return {
      aisle: aisleMatch[1],
      bay: bayMatch[1],
      side: sideMatch[1] as 'Left' | 'Right',
    };
  }
  
  return null;
}


export default function MapPageClient() {
  const [isLoading, setIsLoading] = useState(false);
  const [isAisleLoading, setIsAisleLoading] = useState(false);
  
  const [locatedProducts, setLocatedProducts] = useState<LocatedProduct[]>([]);
  const [allHits, setAllHits] = useState<SearchHit[]>([]);
  const [highlightedAisle, setHighlightedAisle] = useState<string | null>(null);
  const [hoveredProductSku, setHoveredProductSku] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { toast } = useToast();
  const { settings, setSettings } = useApiSettings();
  const searchParams = useSearchParams();

  const aisleForm = useForm<z.infer<typeof AisleFormSchema>>({
    resolver: zodResolver(AisleFormSchema),
    defaultValues: { productCategory: '' },
  });
  
  const handleReset = () => {
      setLocatedProducts([]);
      setAllHits([]);
      setHighlightedAisle(null);
      setHoveredProductSku(null);
      setShowAll(false);
  }

  const fetchAndSetProducts = useCallback(async (skus: string[], append = false) => {
    if (skus.length === 0) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    toast({ title: 'Locating products...', description: `Fetching details for ${skus.length} items.`});
    const { locationId } = settings;

    if (!locationId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please set a store ID in settings.' });
        setIsLoading(false);
        return;
    }

    const { data, error } = await getProductData({
        locationId,
        skus,
        bearerToken: settings.bearerToken,
        debugMode: settings.debugMode,
    });
    
    setIsLoading(false);

    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error });
        return;
    }

    if (data) {
        const productsWithLocations: LocatedProduct[] = data.map(product => {
            const location = parseLocationString(product.location.standard);
            return location ? { ...product, location } : null;
        }).filter((p): p is LocatedProduct => p !== null);
        
        if (append) {
          setLocatedProducts(prev => {
              const existingSkus = new Set(prev.map(p => p.sku));
              const newProducts = productsWithLocations.filter(p => !existingSkus.has(p.sku));
              return [...prev, ...newProducts];
          });
        } else {
          setLocatedProducts(productsWithLocations);
        }
        
        toast({ title: 'Products Located', description: `Found ${productsWithLocations.length} new items on the map.`});
    }
  }, [settings, toast]);


  const handleSearch = useCallback(async (hits: SearchHit[]) => {
      if (hits.length === 0) {
          handleReset();
          return;
      }
      handleReset();
      setAllHits(hits);
      
      const initialHits = hits.slice(0, 5);
      const skusToFetch = initialHits.map(h => h.retailerProductId).filter((sku): sku is string => !!sku);
      await fetchAndSetProducts(skusToFetch);
  }, [fetchAndSetProducts]);

  const handleShowAll = async () => {
    if (showAll || allHits.length <= 5) return;
    
    setShowAll(true);
    const remainingHits = allHits.slice(5);
    const skusToFetch = remainingHits.map(h => h.retailerProductId).filter((sku): sku is string => !!sku);

    if (skusToFetch.length > 0) {
      await fetchAndSetProducts(skusToFetch, true);
    }
  };


  const onAisleSubmit = async (values: z.infer<typeof AisleFormSchema>) => {
    setIsAisleLoading(true);
    handleReset();

    try {
      const result = await findAisleForProductTool({ productCategory: values.productCategory });
      if (result.bestAisleId) {
        setHighlightedAisle(result.bestAisleId);
        toast({ title: 'Aisle Found!', description: `This is the suggested aisle for ${values.productCategory}.` });
      } else {
        toast({ variant: 'destructive', title: 'Aisle Not Found', description: `Could not determine an aisle for ${values.productCategory}.` });
      }
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        toast({ variant: 'destructive', title: 'Error', description: `An error occurred: ${error}` });
    } finally {
        setIsAisleLoading(false);
    }
  };

  const productLocations = useMemo(() => {
    return locatedProducts.map(p => ({
        sku: p.sku,
        location: p.location,
    }))
  }, [locatedProducts]);


  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="w-full lg:w-[350px] flex-shrink-0">
            <div className="space-y-8">
              <div className="sticky top-20">
                <Card className="shadow-md">
                   <CardHeader>
                      <CardTitle>Find on Map</CardTitle>
                      <CardDescription>Find a general aisle, or search for specific products to see all their locations.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <SearchComponent onSearch={handleSearch} onClear={handleReset} />
                    <Separator />
                    <Form {...aisleForm}>
                      <form onSubmit={aisleForm.handleSubmit(onAisleSubmit)} className="space-y-4">
                         <FormField
                          control={aisleForm.control}
                          name="productCategory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Find by Category</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Ketchup, Dog Food" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={isAisleLoading}
                        >
                          {isAisleLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <BrainCircuit className="mr-2 h-4 w-4" />
                          )}
                          Find Aisle
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
                
                {(isLoading || locatedProducts.length > 0) && (
                    <Card className="mt-8">
                        <CardHeader>
                            <CardTitle>Search Results</CardTitle>
                            <CardDescription>
                                {isLoading ? 'Locating products...' : `${locatedProducts.length} of ${allHits.length} items found on the map.`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px] pr-4 -mr-4">
                                <div className="space-y-4">
                                    {isLoading && locatedProducts.length === 0 && Array.from({length: 3}).map((_, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <Skeleton className="w-16 h-16 rounded-md" />
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-48" />
                                                <Skeleton className="h-3 w-32" />
                                            </div>
                                        </div>
                                    ))}
                                    {locatedProducts.map(p => (
                                        <div 
                                            key={p.sku} 
                                            className={cn(
                                                "p-2 rounded-md flex items-center gap-4 transition-colors cursor-pointer",
                                                hoveredProductSku === p.sku ? 'bg-accent' : 'hover:bg-accent/50'
                                            )}
                                            onMouseEnter={() => setHoveredProductSku(p.sku)}
                                            onMouseLeave={() => setHoveredProductSku(null)}
                                        >
                                            <Image
                                                src={p.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'}
                                                alt={p.name}
                                                width={50}
                                                height={50}
                                                className="rounded-md border object-cover bg-white"
                                            />
                                            <div className="flex-grow min-w-0">
                                                <p className="font-semibold truncate text-sm">{p.name}</p>
                                                <p className="text-xs text-muted-foreground">{p.location.standard}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && locatedProducts.length > 0 && (
                                       <div className="flex items-center justify-center py-4">
                                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                       </div>
                                    )}
                                </div>
                            </ScrollArea>
                            {allHits.length > 5 && !showAll && (
                                <div className="mt-4">
                                    <Button variant="outline" className="w-full" onClick={handleShowAll} disabled={isLoading}>
                                        {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                        Show all {allHits.length} results
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}


              </div>

            </div>
          </div>

          <div className="flex-grow w-full border rounded-lg bg-card shadow-lg overflow-x-auto">
              <StoreMap 
                productLocations={productLocations} 
                highlightedAisle={highlightedAisle} 
                hoveredProductSku={hoveredProductSku}
                onPinHover={(sku) => setHoveredProductSku(sku)}
                onPinLeave={() => setHoveredProductSku(null)}
              />
          </div>
        </div>

      </main>
    </div>
  );
}

    