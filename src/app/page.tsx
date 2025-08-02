'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PackageSearch, Search, ShoppingBasket, LayoutGrid, List } from 'lucide-react';
import ProductCard from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';

type Product = FetchMorrisonsDataOutput[0];

const FormSchema = z.object({
  skus: z.string().min(1, { message: 'Please enter at least one SKU.' }),
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
});

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<string>('stockQuantity-desc');
  const [filterQuery, setFilterQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const { toast } = useToast();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      skus: '',
      locationId: '218',
    },
  });

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
      setProducts(data);
    }
    setIsLoading(false);
  }

  const sortedAndFilteredProducts = useMemo(() => {
    let result: Product[] = [...products].filter((p) =>
      p.name.toLowerCase().includes(filterQuery.toLowerCase())
    );

    const [key, direction] = sortConfig.split('-');
    
    result.sort((a, b) => {
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

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-4">
             <ShoppingBasket className="w-12 h-12 text-primary" />
            <h1 className="text-5xl font-bold tracking-tight text-primary">
              Morri<span className="text-foreground">Cards</span>
            </h1>
          </div>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Quickly check product stock, price, and location in your Morrisons store. Just paste your SKUs and get started.
          </p>
        </header>

        <Card className="max-w-4xl mx-auto mb-12 shadow-lg">
          <CardHeader>
            <CardTitle>Find Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="skus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product SKUs</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter SKUs separated by commas, spaces, or new lines... e.g. 369966011, 119989011"
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
                    'Get Product Info'
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
                        <Select value={sortConfig} onValueChange={setSortConfig}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Sort by..." />
                            </SelectTrigger>
                            <SelectContent>
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
      </main>
    </div>
  );
}
