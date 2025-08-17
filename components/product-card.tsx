
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Boxes, MapPin, PoundSterling, Tag, ChevronDown, Barcode, Thermometer, Weight, Info, Footprints, Leaf, Shell, Beaker, CheckCircle2, Expand, Snowflake, ThermometerSnowflake, AlertTriangle, Globe, Crown, GlassWater, FileText, Package, CalendarClock, Flag, Building2, Layers, WifiOff, Map, Truck } from 'lucide-react';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Checkbox } from './ui/checkbox';
import ImageModal from './image-modal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Skeleton } from './ui/skeleton';
import SkuQrCode from './SkuQrCode';
import Link from 'next/link';

type Product = FetchMorrisonsDataOutput[0] & { picked?: boolean, productDetails: { productRestrictions?: { operatorAgeCheck?: string } } & FetchMorrisonsDataOutput[0]['productDetails'], isOffline?: boolean };

interface ProductCardProps {
  product: Product;
  layout: 'grid' | 'list';
  onPick?: (sku: string) => void;
  isPicker?: boolean;
  locationId?: string;
}

const DataRow = ({ icon, label, value, valueClassName }: { icon: React.ReactNode, label: string, value?: string | number | null | React.ReactNode, valueClassName?: string }) => {
    if (value === undefined || value === null || value === '') return null;
    return (
        <div className="flex items-start gap-3">
            <div className="w-5 h-5 text-muted-foreground flex-shrink-0 pt-0.5">{icon}</div>
            <div className='flex-grow min-w-0'>
                <span className="font-bold">{label}:</span> <span className={cn('break-words', valueClassName)}>{value}</span>
            </div>
        </div>
    );
}

export default function ProductCard({ product, layout, onPick, isPicker = false, locationId }: ProductCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const isPicked = product.picked;

  const handlePick = () => {
    if (onPick) {
      onPick(product.sku);
    }
  }

  const stockColor = product.stockQuantity > 20 ? 'bg-green-500' : product.stockQuantity > 0 ? 'bg-yellow-500' : 'bg-red-500';
  const placeholderImage = `https://placehold.co/400x400.png`;
  const imageUrl = product.imageUrl;
  
  const isAgeRestricted = product.productDetails?.productRestrictions?.operatorAgeCheck === 'Yes';
  const bws = product.productDetails.beersWinesSpirits;
  const hasBwsDetails = bws && (bws.alcoholByVolume || bws.tastingNotes || bws.volumeInLitres);

  if (product.isOffline) {
    return (
        <Card 
            data-sku={product.sku}
            className={cn(
                "w-full transition-all duration-300 flex flex-col relative bg-muted/30 overflow-hidden", 
                layout === 'list' && "flex-row",
            )}>
            <div className={cn("flex flex-col flex-grow", layout === 'list' ? 'w-full' : '')}>
                <CardHeader className={cn(layout === 'list' && 'p-4 flex-row items-center gap-4', 'pb-2')}>
                    <div className='flex-grow space-y-2'>
                        <CardTitle className="text-lg leading-tight flex items-center gap-2 text-muted-foreground">
                            <WifiOff className="h-5 w-5" /> Offline Item
                        </CardTitle>
                        <Skeleton className="h-4 w-3/4" />
                        <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                        <p className="text-xs text-amber-600">Details will be fetched when back online.</p>
                    </div>
                </CardHeader>
            </div>
        </Card>
    )
  }


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
                  
                />
              </div>
            </ImageModal>
          </div>
        )}
        <div className={cn("flex flex-col flex-grow", layout === 'list' ? 'w-full' : '')}>
          <CardHeader className={cn(layout === 'list' && 'p-4 flex-row items-start gap-4', 'pb-2', layout === 'grid' && 'pt-0')}>
             {isPicker && (
                <div className="flex flex-col items-center space-y-2 pt-1">
                    <Checkbox
                        id={`pick-${product.sku}`}
                        checked={isPicked}
                        onCheckedChange={handlePick}
                        className="h-6 w-6"
                        aria-label={`Pick ${product.name}`}
                    />
                </div>
            )}
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
                    
                  />
                </div>
              </ImageModal>
            )}
            <div className='flex-grow min-w-0'>
                <CardTitle className="text-lg leading-tight">{product.name}</CardTitle>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground mt-2">
                    {product.temperature === 'Chilled' && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 text-xs cursor-default">
                                        <ThermometerSnowflake className="h-4 w-4" />
                                        <span>Chilled</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>This item is chilled and requires refrigeration.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    {product.temperature === 'Frozen' && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 text-xs cursor-default">
                                        <Snowflake className="h-4 w-4" />
                                        <span>Frozen</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>This item is frozen.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    {isAgeRestricted && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 text-xs text-destructive cursor-default">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span>Age Restricted</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Age verification is required for this item.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                {product.price.promotional && (
                    <CardDescription className="pt-2">
                        <Badge variant="destructive" className="bg-accent text-accent-foreground">{product.price.promotional}</Badge>
                    </CardDescription>
                )}
            </div>
          </CardHeader>
          <CardContent className={cn('flex-grow', layout === 'list' ? 'p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-start' : 'p-6 pt-0 space-y-3')}>
              <div className="flex items-center gap-3 text-sm">
                  <Boxes className="h-5 w-5 text-primary" />
                  <span>Stock record: <strong>{product.stockQuantity} {product.stockUnit}</strong></span>
                  <div className={`h-2.5 w-2.5 rounded-full ${stockColor}`} title={`Stock level: ${product.stockQuantity}`}></div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                  <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-grow">
                      <span>Location: <strong>{product.location.standard || 'None'}</strong></span>
                      {product.location.secondary && (
                          <div className="text-xs text-muted-foreground">
                              Secondary: {product.location.secondary}
                          </div>
                      )}
                  </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                  <PoundSterling className="h-5 w-5 text-primary" />
                  <span>Price: <strong>£{product.price.regular?.toFixed(2) || 'N/A'}</strong></span>
              </div>
               {product.nextDelivery && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-3 text-sm text-blue-600 cursor-default">
                            <Truck className="h-5 w-5" />
                            <span>Next delivery: <strong>{product.nextDelivery.quantity} {product.nextDelivery.quantityType}(s)</strong></span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Expected on: {product.nextDelivery.expectedDate}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
          </CardContent>

          <CollapsibleContent>
              <div className={cn("px-6 pb-4 overflow-hidden max-h-96", layout === 'list' && 'px-4')}>
                  <div className="border-t pt-4 mt-4 space-y-4 text-sm text-muted-foreground">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DataRow icon={<Barcode />} label="SKU" value={`${product.sku} (EAN: ${product.scannedSku}) ${product.stockSkuUsed ? `(Stock SKU: ${product.stockSkuUsed})` : ''}`} />
                        <DataRow icon={<Info />} label="Status" value={product.status} />
                        <DataRow icon={<Footprints />} label="Walk Sequence" value={product.walkSequence} />
                        <DataRow icon={<Tag />} label="Promo Location" value={product.location.promotional} />
                        <DataRow icon={<Crown />} label="Brand" value={product.productDetails.brand} />
                        <DataRow icon={<Globe />} label="Country of Origin" value={product.productDetails.countryOfOrigin} />
                        <DataRow icon={<Thermometer />} label="Temperature" value={product.temperature} />
                        <DataRow icon={<Weight />} label="Weight" value={product.weight ? `${product.weight} kg` : null} />
                         {locationId && (
                           <div className='md:col-span-2'>
                             <Button variant="outline" size="sm" className="w-full" asChild>
                               <Link href={`/map?sku=${product.sku}&locationId=${locationId}`}>
                                 <Map className="mr-2 h-4 w-4" />
                                 View on Map
                               </Link>
                             </Button>
                           </div>
                          )}
                      </div>
                      
                      <div className="flex justify-center py-2">
                        <SkuQrCode sku={product.sku} />
                      </div>

                       <Separator />
                        <div>
                          <h4 className="font-bold mb-3 flex items-center gap-2"><Package className="h-5 w-5" /> Stock & Logistics</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                             <DataRow icon={<Layers />} label="Storage" value={product.productDetails.storage?.join(', ')} />
                             <DataRow icon={<Layers />} label="Pack Info" value={product.productDetails.packs?.map(p => `${p.packQuantity}x ${p.packNumber}`).join('; ')} />
                             <DataRow icon={<CalendarClock />} label="Min Life (CPC/CFC)" value={product.productDetails.productLife ? `${product.productDetails.productLife.minimumCPCAcceptanceLife} / ${product.productDetails.productLife.minimumCFCAcceptanceLife} days` : null} />
                             <DataRow icon={<Flag />} label="Perishable" value={product.productDetails.productFlags?.perishableInd ? 'Yes' : 'No'} />
                             <DataRow icon={<Flag />} label="Manual Order" value={product.productDetails.manuallyStoreOrderedItem} />
                          </div>
                        </div>


                      {product.productDetails.commercialHierarchy && (
                          <>
                          <Separator />
                          <div>
                              <h4 className="font-bold mb-3 flex items-center gap-2"><Building2 className="h-5 w-5" /> Classification</h4>
                              <p className="text-xs">
                                {product.productDetails.commercialHierarchy.divisionName} &rarr; {product.productDetails.commercialHierarchy.groupName} &rarr; {product.productDetails.commercialHierarchy.className} &rarr; {product.productDetails.commercialHierarchy.subclassName}
                              </p>
                          </div>
                          </>
                      )}

                      {product.productDetails.productMarketing && <Separator />}
                      {product.productDetails.productMarketing && (
                        <div className='italic text-xs'>
                           {product.productDetails.productMarketing}
                        </div>
                      )}


                      { hasBwsDetails && (
                          <>
                            <Separator />
                            <div>
                              <h4 className="font-bold mb-2 flex items-center gap-2"><GlassWater className="h-5 w-5" /> Beers, Wines & Spirits</h4>
                              <div className="space-y-2">
                                  <DataRow icon={<div className='w-5 text-center font-bold'>%</div>} label="ABV" value={bws.alcoholByVolume ? `${bws.alcoholByVolume}%` : null} />
                                  <DataRow icon={<FileText />} label="Tasting Notes" value={bws.tastingNotes} valueClassName='text-xs italic' />
                                  <DataRow icon={<Info />} label="Volume" value={bws.volumeInLitres ? `${bws.volumeInLitres}L` : null} />
                              </div>
                            </div>
                          </>
                      )}


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
                          <summary className="cursor-pointer font-semibold">Raw Data</summary>
                          <pre className="mt-2 bg-muted p-2 rounded-md overflow-auto max-h-48 text-[10px] leading-tight whitespace-pre-wrap break-all">
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
        <Card 
            data-sku={product.sku}
            className={cn(
                "w-full transition-all duration-300 flex flex-col relative overflow-hidden", 
                layout === 'list' && "flex-row",
                isPicker && isPicked ? 'bg-muted/50 opacity-60 scale-95' : 'bg-card hover:shadow-xl hover:-translate-y-1',
                isAgeRestricted ? 'bg-red-50/50' : 
                product.temperature === 'Chilled' ? 'bg-teal-50/50' :
                product.temperature === 'Frozen' ? 'bg-sky-50/50' : ''
            )}>
            {isPicker && isPicked && (
                 <div className="absolute top-2 right-2 z-10 p-1 bg-primary text-primary-foreground rounded-full">
                    <CheckCircle2 className="h-5 w-5" />
                </div>
            )}
           {cardContent}
        </Card>
    </Collapsible>
  );
}
