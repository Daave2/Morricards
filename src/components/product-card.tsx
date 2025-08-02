'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Boxes, MapPin, PoundSterling, Tag, ChevronDown, Barcode, Thermometer, Weight, Info } from 'lucide-react';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

type Product = FetchMorrisonsDataOutput[0];

export default function ProductCard({ product, layout }: { product: Product, layout: 'grid' | 'list' }) {
  const [isOpen, setIsOpen] = useState(false);

  const stockColor = product.stockQuantity > 20 ? 'bg-green-500' : product.stockQuantity > 0 ? 'bg-yellow-500' : 'bg-red-500';
  const placeholderImage = `https://placehold.co/400x400.png`;

  const cardContent = (
      <>
        {layout === 'grid' && (
          <div className="relative aspect-square w-full">
            <Image
              src={product.imageUrl || placeholderImage}
              alt={product.name}
              fill
              className="object-cover rounded-t-lg"
              data-ai-hint="product image"
              unoptimized
            />
          </div>
        )}
        <div className={cn("flex flex-col flex-grow", layout === 'list' ? 'w-full' : '')}>
          <CardHeader className={cn(layout === 'list' && 'p-4 flex-row items-start gap-4', 'pb-2')}>
            {layout === 'list' && (
               <div className="relative aspect-square w-24 h-24 flex-shrink-0">
                <Image
                  src={product.imageUrl || placeholderImage}
                  alt={product.name}
                  fill
                  className="object-cover rounded-md"
                  data-ai-hint="product image"
                  unoptimized
                />
              </div>
            )}
            <div className='flex-grow'>
                <CardTitle className="text-lg leading-tight">{product.name}</CardTitle>
                {product.price.promotional && (
                    <CardDescription className="pt-1">
                        <Badge variant="destructive" className="bg-accent text-accent-foreground">{product.price.promotional}</Badge>
                    </CardDescription>
                )}
            </div>
          </CardHeader>
          <CardContent className={cn('flex-grow', layout === 'list' ? 'p-4 pt-0 grid grid-cols-3 gap-4 items-center' : 'p-6 pt-0 space-y-3')}>
              <div className="flex items-center gap-3 text-sm">
                  <Boxes className="h-5 w-5 text-primary" />
                  <span>Stock: <strong>{product.stockQuantity}</strong> {product.stockUnit}</span>
                  <div className={`h-2.5 w-2.5 rounded-full ${stockColor}`} title={`Stock level: ${product.stockQuantity}`}></div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span>Location: <strong>{product.location.standard || 'N/A'}</strong></span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                  <PoundSterling className="h-5 w-5 text-primary" />
                  <span>Price: <strong>{product.price.regular?.toFixed(2) || 'N/A'}</strong></span>
              </div>
          </CardContent>

          <CollapsibleContent>
              <div className={cn("px-6 pb-4", layout === 'list' && 'px-4')}>
                  <div className="border-t pt-4 mt-4 space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-3">
                          <Barcode className="h-5 w-5" />
                          <span>SKU: {product.sku} {product.stockSkuUsed && `(Stock SKU: ${product.stockSkuUsed})`}</span>
                      </div>
                      {product.location.promotional && (
                           <div className="flex items-center gap-3">
                              <Tag className="h-5 w-5" />
                              <span>Promo Location: {product.location.promotional}</span>
                          </div>
                      )}
                       <div className="flex items-center gap-3">
                          <Thermometer className="h-5 w-5" />
                          <span>{product.temperature || 'Unknown'}</span>
                      </div>
                      {product.weight && (
                          <div className="flex items-center gap-3">
                              <Weight className="h-5 w-5" />
                              <span>{product.weight} kg</span>
                          </div>
                      )}
                       <div className="flex items-center gap-3">
                          <Info className="h-5 w-5" />
                          <span>Status: {product.status}</span>
                      </div>
                      <details className="pt-2 text-xs">
                          <summary className="cursor-pointer">Raw Data</summary>
                          <pre className="mt-2 bg-muted p-2 rounded-md overflow-auto max-h-48">
                              {JSON.stringify(product.productDetails, null, 2)}
                          </pre>
                      </details>
                  </div>
              </div>
          </CollapsibleContent>

          <CardFooter className={cn("pt-4 mt-auto", layout === 'list' ? 'p-0 items-center justify-center' : 'p-6 pt-0')}>
               <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setIsOpen(!isOpen)}>
                      {isOpen ? 'Show Less' : 'Show More'}
                      <ChevronDown className={cn("h-4 w-4 ml-2 transition-transform", isOpen && "rotate-180")} />
                  </Button>
              </CollapsibleTrigger>
          </CardFooter>
        </div>
      </>
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn("w-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col", layout === 'list' && "flex-row")}>
        {cardContent}
      </Card>
    </Collapsible>
  );
}
