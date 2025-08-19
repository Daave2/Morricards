
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Map, Search, BrainCircuit } from 'lucide-react';
import { useApiSettings } from '@/hooks/use-api-settings';
import StoreMap, { type ProductLocation } from '@/components/StoreMap';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { findAisleForProductTool } from '@/ai/flows/aisle-finder-flow';

const SkuFormSchema = z.object({
  sku: z.string().min(1, { message: 'SKU or EAN is required.' }),
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
});

const AisleFormSchema = z.object({
  productCategory: z.string().min(2, { message: 'Please enter a product to find.' }),
});

type Product = FetchMorrisonsDataOutput[0];

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
  const [isSkuLoading, setIsSkuLoading] = useState(false);
  const [isAisleLoading, setIsAisleLoading] = useState(false);
  const [productLocation, setProductLocation] = useState<ProductLocation | null>(null);
  const [highlightedAisle, setHighlightedAisle] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  const { toast } = useToast();
  const { settings } = useApiSettings();
  const searchParams = useSearchParams();

  const skuForm = useForm<z.infer<typeof SkuFormSchema>>({
    resolver: zodResolver(SkuFormSchema),
    defaultValues: { sku: '', locationId: '218' },
  });

  const aisleForm = useForm<z.infer<typeof AisleFormSchema>>({
    resolver: zodResolver(AisleFormSchema),
    defaultValues: { productCategory: '' },
  });

  const onSkuSubmit = async (values: z.infer<typeof SkuFormSchema>) => {
    setIsSkuLoading(true);
    setProductLocation(null);
    setProduct(null);
    setHighlightedAisle(null);

    const { data, error } = await getProductData({
      locationId: values.locationId,
      skus: [values.sku],
      bearerToken: settings.bearerToken,
      debugMode: settings.debugMode,
    });


    if (error || !data || data.length === 0) {
      setIsSkuLoading(false);
      toast({ variant: 'destructive', title: 'Product Not Found', description: `Could not find product data for: ${values.sku}` });
    } else {
      const foundProduct = data[0];
      const parsedLoc = parseLocationString(foundProduct.location.standard);

      if (parsedLoc) {
        setProductLocation(parsedLoc);
        setProduct(foundProduct);
        toast({ title: 'Location Found!', description: `Showing location for ${foundProduct.name}` });
      } else {
         toast({ variant: 'destructive', title: 'Location Data Missing', description: `Could not parse location string: "${foundProduct.location.standard}"` });
      }
      setIsSkuLoading(false);
    }
  };

  const onAisleSubmit = async (values: z.infer<typeof AisleFormSchema>) => {
    setIsAisleLoading(true);
    setProductLocation(null);
    setProduct(null);
    setHighlightedAisle(null);

    try {
      const result = await findAisleForProductTool({ productCategory: values.productCategory });
      if (result.bestAisleId) {
        setHighlightedAisle(result.bestAisleId);
        toast({ title: 'Aisle Found!', description: `AI suggests this is the best aisle for ${values.productCategory}.` });
      } else {
        toast({ variant: 'destructive', title: 'Aisle Not Found', description: `The AI could not determine an aisle for ${values.productCategory}.` });
      }
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        toast({ variant: 'destructive', title: 'AI Error', description: `An error occurred: ${error}` });
    } finally {
        setIsAisleLoading(false);
    }
  };

  useEffect(() => {
    const sku = searchParams.get('sku');
    const locationId = searchParams.get('locationId');

    if (sku && locationId) {
      skuForm.setValue('sku', sku);
      skuForm.setValue('locationId', locationId);
      onSkuSubmit({ sku, locationId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="w-full lg:w-[350px] flex-shrink-0">
            <div className="space-y-8">
              <div className="sticky top-20">
                <Card className="shadow-md">
                   <CardHeader>
                      <CardTitle>Find a Product</CardTitle>
                      <CardDescription>Use AI to find an aisle, or enter a product SKU to find its exact spot.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Form {...aisleForm}>
                      <form onSubmit={aisleForm.handleSubmit(onAisleSubmit)} className="space-y-4">
                         <FormField
                          control={aisleForm.control}
                          name="productCategory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Find by Category (AI)</FormLabel>
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
                          Find Aisle with AI
                        </Button>
                      </form>
                    </Form>
                    <Separator />
                    <Form {...skuForm}>
                      <form onSubmit={skuForm.handleSubmit(onSkuSubmit)} className="space-y-4">
                        <FormField
                          control={skuForm.control}
                          name="sku"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Find by SKU/EAN</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter product number..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={skuForm.control}
                          name="locationId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Store ID</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., 218" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full"
                          variant="secondary"
                          disabled={isSkuLoading}
                        >
                          {isSkuLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="mr-2 h-4 w-4" />
                          )}
                          Find Exact Location
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>

              {isSkuLoading && (
                  <Card className="shadow-lg animate-pulse">
                      <CardHeader className="flex flex-row items-start gap-4">
                          <div className="w-[80px] h-[80px] bg-muted rounded-lg"/>
                          <div className="space-y-2">
                              <div className="h-5 w-48 bg-muted rounded-md"/>
                              <div className="h-4 w-32 bg-muted rounded-md"/>
                          </div>
                      </CardHeader>
                      <CardContent>
                          <div className="h-10 w-full bg-muted rounded-md"/>
                      </CardContent>
                  </Card>
              )}

              {product && productLocation && (
                <div className="sticky top-[36rem]">
                  <Card className="shadow-lg animate-in fade-in-50">
                    <CardHeader className="flex flex-row items-start gap-4">
                      <Image
                        src={product.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'}
                        alt={product.name}
                        width={80}
                        height={80}
                        className="rounded-lg border object-cover"
                      />
                      <div>
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <CardDescription>SKU: {product.sku}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Alert>
                        <Map className="h-4 w-4" />
                        <AlertTitle>Location</AlertTitle>
                        <AlertDescription className="font-semibold text-foreground">
                          {product.location.standard}
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                </div>
              )}

            </div>
          </div>

          <div className="flex-grow w-full border rounded-lg bg-card shadow-lg overflow-x-auto">
              <StoreMap productLocation={productLocation} highlightedAisle={highlightedAisle} />
          </div>
        </div>

      </main>
    </div>
  );
}
