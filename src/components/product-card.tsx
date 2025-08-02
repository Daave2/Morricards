'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Boxes, MapPin, PoundSterling, Tag, ChevronDown, Barcode } from 'lucide-react';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

type Product = FetchMorrisonsDataOutput[0];

export default function ProductCard({ product, layout }: { product: Product, layout: 'grid' | 'list' }) {
  const [isOpen, setIsOpen] = useState(false);

  const stockColor = product.stockQuantity > 20 ? 'bg-green-500' : product.stockQuantity > 0 ? 'bg-yellow-500' : 'bg-red-500';

  const cardContent = (
      <>
        <CardHeader className={cn(layout === 'list' && 'p-4')}>
            <CardTitle className="text-lg leading-tight">{product.name}</CardTitle>
            {product.promotion && (
                <CardDescription className="pt-1">
                    <Badge variant="destructive" className="bg-accent text-accent-foreground">{product.promotion}</Badge>

                </CardDescription>
            )}
        </CardHeader>
        <CardContent className={cn('flex-grow', layout === 'list' ? 'p-4 grid grid-cols-3 gap-4' : 'space-y-3')}>
            <div className="flex items-center gap-3 text-sm">
                <Boxes className="h-5 w-5 text-primary" />
                <span>Stock: <strong>{product.stockQuantity}</strong></span>
                <div className={`h-2.5 w-2.5 rounded-full ${stockColor}`} title={`Stock level: ${product.stockQuantity}`}></div>
            </div>
            <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-5 w-5 text-primary" />
                <span>Location: <strong>{product.location}</strong></span>
            </div>
            <div className="flex items-center gap-3 text-sm">
                <PoundSterling className="h-5 w-5 text-primary" />
                <span>Price: <strong>{product.price.toFixed(2)}</strong></span>
            </div>
        </CardContent>

        <CollapsibleContent>
            <div className={cn("px-6 pb-4", layout === 'list' && 'px-4')}>
                <div className="border-t pt-4 mt-4 space-y-2 text-sm text-muted-foreground">
                     <div className="flex items-center gap-3">
                        <Barcode className="h-5 w-5" />
                        <span>SKU: {product.sku}</span>
                    </div>
                </div>
            </div>
        </CollapsibleContent>

        <CardFooter className={cn("pt-4", layout === 'list' && 'p-0 items-center justify-center')}>
             <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setIsOpen(!isOpen)}>
                    {isOpen ? 'Show Less' : 'Show More'}
                    <ChevronDown className={cn("h-4 w-4 ml-2 transition-transform", isOpen && "rotate-180")} />
                </Button>
            </CollapsibleTrigger>
        </CardFooter>
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
