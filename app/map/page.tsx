
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Map, Search, ChevronLeft } from 'lucide-react';
import { useApiSettings } from '@/hooks/use-api-settings';
import Link from 'next/link';
import StoreMap, { type ProductLocation } from '@/components/StoreMap';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import Image from 'next/image';

const FormSchema = z.object({
  sku: z.string().min(1, { message: 'SKU or EAN is required.' }),
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
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


export default function MapPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [productLocation, setProductLocation] = useState<ProductLocation | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  const { toast } = useToast();
  const { settings } = useApiSettings();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { sku: '', locationId: '218' },
  });

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    setIsLoading(true);
    setProductLocation(null);
    setProduct(null);

    const { data, error } = await getProductData({
      locationId: values.locationId,
      skus: [values.sku],
      bearerToken: settings.bearerToken,
      debugMode: settings.debugMode,
    });


    if (error || !data || data.length === 0) {
      setIsLoading(false);
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
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-12">
          <div className="flex justify-center items-center gap-4">
            <Map className="w-12 h-12 text-primary" />
            <h1 className="text-5xl font-bold tracking-tight text-primary">Precise Store Map</h1>
          </div>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Search for a product to see its exact location plotted on the map.
          </p>
          <Button variant="link" asChild className="mt-2">
            <Link href="/">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Picking List
            </Link>
          </Button>
        </header>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="w-full lg:w-[350px] flex-shrink-0">
            <div className="sticky top-4 space-y-8">
              <Card className="shadow-md">
                <CardHeader>
                    <CardTitle>Find a Product</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="sku"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SKU or EAN</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter product number..." {...field} />
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
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="mr-2 h-4 w-4" />
                        )}
                        Find Product
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {isLoading && (
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
                <Card className="shadow-lg animate-in fade-in-50">
                  <CardHeader className="flex flex-row items-start gap-4">
                    <Image
                      src={product.imageUrl || 'https://placehold.co/100x100.png'}
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
              )}

              {!productLocation && !isLoading && (
                  <Alert className="lg:col-span-1">
                      <Map className="h-4 w-4" />
                      <AlertTitle>Ready to Search</AlertTitle>
                      <AlertDescription>
                          Enter a product SKU or EAN above to see its precise location on the map.
                      </AlertDescription>
                  </Alert>
              )}
            </div>
          </div>

          <div className="flex-grow w-full border rounded-lg bg-card shadow-lg overflow-x-auto">
              <StoreMap productLocation={productLocation} />
          </div>
        </div>

      </main>
    </div>
  );
}
