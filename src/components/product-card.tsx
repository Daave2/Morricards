
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Boxes, MapPin, PoundSterling, Tag, ChevronDown, Barcode, Thermometer, Weight, Info, Footprints, Leaf, Shell, Beaker, CheckCircle2, Expand, Snowflake, ThermometerSnowflake, AlertTriangle } from 'lucide-react';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Checkbox } from './ui/checkbox';
import ImageModal from './image-modal';

type Product = FetchMorrisonsDataOutput[0] & { picked?: boolean, productDetails: { operatorAgeCheck?: string } & FetchMorrisonsDataOutput[0]['productDetails'] };

interface ProductCardProps {
  product: Product;
  layout: 'grid' | 'list';
  onPick: (sku: string) => void;
}

const DataRow = ({ icon, label, value }: { icon: React.ReactNode, label: string, value?: string | number | null }) => {
    if (value === undefined || value === null || value === '') return null;
    return (
        <div className="flex items-start gap-3">
            <div className="w-5 h-5 text-muted-foreground flex-shrink-0">{icon}</div>
            <span><strong>{label}:</strong> {value}</span>
        </div>
    );
}

export default function ProductCard({ product, layout, onPick }: ProductCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const stockColor = product.stockQuantity > 20 ? 'bg-green-500' : product.stockQuantity > 0 ? 'bg-yellow-500' : 'bg-red-500';
  const placeholderImage = `https://placehold.co/400x400.png`;
  const imageUrl = product.imageUrl;
  
  const isAgeRestricted = product.productDetails?.operatorAgeCheck === 'Yes';

  const cardContent = (
      <>
        {layout === 'grid' && (
           <div className="p-4 flex justify-center">
            <ImageModal src={imageUrl || placeholderImage} alt={product.name}>
              <div className="relative aspect-square w-32 h-32 cursor-pointer group/image border rounded-lg overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity">
                    <Expand className="h-6 w-6 text-white" />
                </div>
                <Image
                  src={imageUrl || placeholderImage}
                  alt={product.name}
                  fill
                  className="object-cover"
                  data-ai-hint="product image"
                  unoptimized
                />
              </div>
            </ImageModal>
          </div>
        )}
        <div className={cn("flex flex-col flex-grow", layout === 'list' ? 'w-full' : '')}>
          <CardHeader className={cn(layout === 'list' && 'p-4 flex-row items-start gap-4', 'pb-2', layout === 'grid' && 'pt-0')}>
             <div className="flex flex-col items-center space-y-2 pt-1">
                <Checkbox
                    id={`pick-${product.sku}`}
                    checked={product.picked}
                    onCheckedChange={() => onPick(product.sku)}
                    className="h-6 w-6"
                />
                <div className="flex gap-1.5 text-muted-foreground">
                    {product.temperature === 'Chilled' && <ThermometerSnowflake className="h-4 w-4" title="Chilled" />}
                    {product.temperature === 'Frozen' && <Snowflake className="h-4 w-4" title="Frozen" />}
                    {isAgeRestricted && <AlertTriangle className="h-4 w-4 text-destructive" title="Age restricted" />}
                </div>
            </div>
            {layout === 'list' && (
              <ImageModal src={imageUrl || placeholderImage} alt={product.name}>
                <div className="relative aspect-square w-24 h-24 flex-shrink-0 cursor-pointer group/image">
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity rounded-md">
                        <Expand className="h-6 w-6 text-white" />
                    </div>
                  <Image
                    src={imageUrl || placeholderImage}
                    alt={product.name}
                    fill
                    className="object-cover rounded-md"
                    data-ai-hint="product image"
                    unoptimized
                  />
                </div>
              </ImageModal>
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
                  <div className="border-t pt-4 mt-4 space-y-4 text-sm text-muted-foreground">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DataRow icon={<Barcode />} label="SKU" value={`${product.sku} (EAN: ${product.scannedSku}) ${product.stockSkuUsed ? `(Stock SKU: ${product.stockSkuUsed})` : ''}`} />
                        <DataRow icon={<Footprints />} label="Walk Sequence" value={product.walkSequence} />
                        <DataRow icon={<Tag />} label="Promo Location" value={product.location.promotional} />
                        <DataRow icon={<Thermometer />} label="Temperature" value={product.temperature} />
                        <DataRow icon={<Weight />} label="Weight" value={product.weight ? `${product.weight} kg` : null} />
                        <DataRow icon={<Info />} label="Status" value={product.status} />
                      </div>

                      { (product.productDetails.ingredients?.length || product.productDetails.allergenInfo?.length) && <Separator /> }
                      
                      {product.productDetails.ingredients && product.productDetails.ingredients.length > 0 && (
                          <div>
                              <h4 className="font-bold mb-2 flex items-center gap-2"><Leaf className="h-5 w-5" /> Ingredients</h4>
                              <p className="text-xs">{product.productDetails.ingredients.join(', ')}</p>
                          </div>
                      )}
                      
                      {product.productDetails.allergenInfo && product.productDetails.allergenInfo.length > 0 && (
                          <div>
                              <h4 className="font-bold mb-2 flex items-center gap-2"><Shell className="h-5 w-5" /> Allergens</h4>
                              <div className="flex flex-wrap gap-2">
                                {product.productDetails.allergenInfo.map(allergen => (
                                    <Badge key={allergen.name} variant={allergen.value === 'Contains' ? 'destructive' : 'secondary'}>
                                        {allergen.name}
                                    </Badge>
                                ))}
                              </div>
                          </div>
                      )}

                      {product.productDetails.nutritionalInfo && <Separator />}

                      {product.productDetails.nutritionalInfo && (
                        <div>
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Beaker className="h-5 w-5" /> Nutrition</h4>
                            <p className="text-xs text-muted-foreground mb-2">{product.productDetails.nutritionalHeading}</p>
                            <div className='space-y-1 text-xs'>
                                {product.productDetails.nutritionalInfo
                                    .filter(n => !n.name.startsWith('*'))
                                    .map(nutrient => (
                                    <div key={nutrient.name} className="flex justify-between border-b pb-1">
                                        <span>{nutrient.name}</span>
                                        <span className="text-right">{nutrient.perComp?.split(',')[0]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                      )}


                      <details className="pt-2 text-xs">
                          <summary className="cursor-pointer">Raw Data</summary>
                          <pre className="mt-2 bg-muted p-2 rounded-md overflow-auto max-h-48">
                              {JSON.stringify(product, null, 2)}
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
        <Card className={cn(
            "w-full transition-all duration-300 flex flex-col", 
            layout === 'list' && "flex-row",
            product.picked ? 'bg-muted/50 opacity-60' : 'bg-card hover:shadow-xl hover:-translate-y-1'
        )}>
            {product.picked && (
                 <div className="absolute top-2 right-2 z-10 p-1 bg-primary text-primary-foreground rounded-full">
                    <CheckCircle2 className="h-5 w-5" />
                </div>
            )}
           {cardContent}
        </Card>
    </Collapsible>
  );
}
