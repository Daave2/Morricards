
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Map, Search, ChevronLeft } from 'lucide-react';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { useApiSettings } from '@/hooks/use-api-settings';
import Link from 'next/link';
import StoreMap from '@/components/StoreMap';

type Product = FetchMorrisonsDataOutput[0];

const FormSchema = z.object({
  sku: z.string().min(1, { message: 'SKU or EAN is required.' }),
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
});

const AISLE_NAME_MAP: Record<string, string> = {
    'Ambient Grocery': 'International, Soup/Veg, Spices/meat',
    'Confectionery, Snacks & Biscuits': 'Sweets, Biscuits, Crisps',
    'Drinks': 'Pop, Water',
    'Household & Pet': 'Paper, Cleaning, Cat, Dog, Home',
    'News, Mags, Tobacco & Home': 'Stationery, Home, Leisure',
    'Beers, Wines & Spirits': 'Beer, Wine, Spirits',
    'Produce': 'Fruit & Veg',
    'Chilled Foods': 'Dairy, Cheese, Butter, Ready Meals, Dips, Pizzas, Coleslaw',
    'Bakery': 'Bakery',
    'Deli': 'Deli, Ham',
    'Meat & Fish': 'Meat, Seafood',
    'Frozen Foods': 'Frozen',
};

export default function MapPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedAisle, setHighlightedAisle] = useState<string | null>(null);

  const { toast } = useToast();
  const { settings } = useApiSettings();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { sku: '', locationId: '218' },
  });

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    setIsLoading(true);
    setHighlightedAisle(null);

    const { data, error } = await getProductData({
      locationId: values.locationId,
      skus: [values.sku],
      bearerToken: settings.bearerToken,
      debugMode: settings.debugMode,
    });

    setIsLoading(false);

    if (error || !data || data.length === 0) {
      toast({ variant: 'destructive', title: 'Product Not Found', description: `Could not find product data for: ${values.sku}` });
    } else {
      const foundProduct = data[0];
      const aisle = foundProduct.productDetails.commercialHierarchy?.groupName || foundProduct.productDetails.commercialHierarchy?.className || null;
      const mappedAisle = aisle ? (AISLE_NAME_MAP[aisle] || aisle) : null;
      
      setHighlightedAisle(mappedAisle);
      toast({ title: 'Product Found', description: `Showing location for ${foundProduct.name}. Highlight: ${mappedAisle}` });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-12">
          <div className="flex justify-center items-center gap-4">
            <Map className="w-12 h-12 text-primary" />
            <h1 className="text-5xl font-bold tracking-tight text-primary">Store Map</h1>
          </div>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Search for a product to see its location highlighted on the map.
          </p>
          <Button variant="link" asChild className="mt-2">
            <Link href="/">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Picking List
            </Link>
          </Button>
        </header>

        <Card className="max-w-4xl mx-auto mb-8 shadow-md">
          <CardHeader>
              <CardTitle>Find a Product</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row items-end gap-4">
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem className="w-full sm:w-auto sm:flex-grow">
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
                    <FormItem className="w-full sm:w-1/4">
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
                  className="w-full sm:w-auto flex-shrink-0"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Find
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="border rounded-lg bg-card shadow-lg overflow-hidden">
            <StoreMap highlightedAisle={highlightedAisle} />
        </div>

      </main>
    </div>
  );
}
