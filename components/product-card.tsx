

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Boxes, MapPin, PoundSterling, Tag, ChevronDown, Barcode, Thermometer, Weight, Info, Footprints, Leaf, Shell, Beaker, CheckCircle2, Expand, Snowflake, ThermometerSnowflake, AlertTriangle, Globe, Crown, GlassWater, FileText, Package, CalendarClock, Flag, Building2, Layers, WifiOff, Map, Truck, History } from 'lucide-react';
import type { FetchMorrisonsDataOutput, DeliveryInfo, Order } from '@/lib/morrisons-api';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Checkbox } from './ui/checkbox';
import ImageModal from './image-modal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Skeleton } from './ui/skeleton';
import SkuQrCode from './SkuQrCode';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';


type Product = FetchMorrisonsDataOutput[0] & { picked?: boolean, isOffline?: boolean };

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

const DeliveryDetailsModal = ({ orders, productName }: { orders: Order[], productName: string }) => {
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Delivery History for {productName}</DialogTitle>
      </DialogHeader>
      <div className="max-h-[70vh] overflow-y-auto pr-4 space-y-4">
        {orders.length > 0 ? orders.map((order, index) => {
          const expectedDate = order.delivery?.dateDeliveryExpected || order.lines?.status?.[0]?.ordered?.date;
          return (
            <Card key={`${order.orderId}-${order.orderPosition}-${index}`}>
              <CardHeader>
                <CardTitle className="text-lg flex justify-between items-center">
                  <span>Order: {order.orderPosition === 'next' ? 'Next' : 'Last'}</span>
                  <Badge variant={order.statusCurrent === 'receipted' ? 'default' : 'secondary'}>{order.statusCurrent}</Badge>
                </CardTitle>
                <CardDescription>
                  Created: {new Date(order.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                  <DataRow icon={<CalendarClock/>} label="Expected Delivery" value={expectedDate ? new Date(expectedDate).toLocaleDateString() : 'N/A'} />
                  {order.lines?.status?.map((s, i) => (
                      <div key={i} className="pl-4 border-l-2 ml-2 space-y-2">
                          {s.ordered && (
                              <div>
                                  <p className="font-semibold">Ordered</p>
                                  <DataRow icon={<Package/>} label="Quantity" value={`${s.ordered.quantity} ${s.ordered.quantityType}(s)`} />
                                  <DataRow icon={<CalendarClock/>} label="Date" value={s.ordered.date ? new Date(s.ordered.date).toLocaleDateString() : 'N/A'} />
                              </div>
                          )}
                          {s.receipted && (
                              <div>
                                  <p className="font-semibold">Receipted</p>
                                  <DataRow icon={<CheckCircle2/>} label="Quantity" value={`${s.receipted.quantity} ${s.receipted.quantityType}(s)`} />
                                  <DataRow icon={<CalendarClock/>} label="Date" value={s.receipted.date ? new Date(s.receipted.date).toLocaleString() : 'N/A'} />
                              </div>
                          )}
                      </div>
                  ))}
              </CardContent>
            </Card>
          )
        }) : <p>No delivery history found.</p>}
      </div>
    </DialogContent>
  )
}

const DeliveryInfoRow = ({ deliveryInfo, allOrders, productName }: { deliveryInfo?: DeliveryInfo | null, allOrders?: Order[] | null, productName: string }) => {
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        // Add timezone offset to treat date as local
        const adjustedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
        return adjustedDate.toLocaleDateString('en-GB', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short', 
            year: '2-digit' 
        });
    };
    
    const deliveryInfoContent = deliveryInfo ? (
      <span>
        {deliveryInfo.orderPosition === 'next' ? 'Next delivery' : 'Last delivery'}: <strong>{formatDate(deliveryInfo.expectedDate)} - {deliveryInfo.totalUnits} units</strong>
      </span>
    ) : (
        <span>Next delivery: <strong>None</strong></span>
    );
  
  const hasAllOrders = allOrders && allOrders.length > 0;

  if (hasAllOrders) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="flex items-center gap-3 text-sm cursor-pointer hover:underline">
                    <Truck className="h-5 w-5 text-primary" />
                    {deliveryInfoContent}
                </div>
            </DialogTrigger>
            <DeliveryDetailsModal orders={allOrders} productName={productName} />
        </Dialog>
    )
  }

  return (
    <div className="flex items-center gap-3 text-sm">
        <Truck className="h-5 w-5 text-primary" />
        {deliveryInfoContent}
    </div>
  )
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
  const mainImage = product.productDetails?.imageUrl?.[0]?.url;
  const imageUrl = mainImage || placeholderImage;
  
  const isAgeRestricted = product.productDetails?.productRestrictions?.operatorAgeCheck === 'Yes';
  const bws = product.productDetails.beersWinesSpirits;
  const hasBwsDetails = bws && (bws.alcoholByVolume || bws.tastingNotes || bws.volumeInLitres);

  if (product.isOffline) {
    return (
        <Card 
            data-sku={product.sku}
            className={cn(
                "w-full transition-all duration-300 flex flex-col relative overflow-hidden", 
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
            <ImageModal src={imageUrl} alt={product.name}>
              <div className="relative aspect-square w-32 h-32 cursor-pointer group/image border rounded-lg overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity">
                    <Expand className="h-6 w-6 text-white" />
                </div>
                <Image
                  src={imageUrl}
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
              <ImageModal src={imageUrl} alt={product.name}>
                <div className="relative aspect-square w-24 h-24 flex-shrink-0 cursor-pointer group/image">
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity rounded-md">
                        <Expand className="h-6 w-6 text-white" />
                    </div>
                  <Image
                    src={imageUrl}
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
              
              <DeliveryInfoRow deliveryInfo={product.deliveryInfo} allOrders={product.allOrders} productName={product.name} />

          </CardContent>

          <CollapsibleContent>
              <div className={cn("px-6 pb-4 overflow-y-auto max-h-96", layout === 'list' ? 'px-4' : '')}>
                  <div className="border-t pt-4 mt-4 space-y-4 text-sm text-muted-foreground">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DataRow icon={<Barcode />} label="SKU" value={`${product.sku} (EAN: ${product.primaryEan13 || product.scannedSku}) ${product.stockSkuUsed ? `(Stock SKU: ${product.stockSkuUsed})` : ''}`} />
                        <DataRow icon={<Info />} label="Status" value={product.status} />
                        <DataRow icon={<Footprints />} label="Walk Sequence" value={product.productDetails.legacyItemNumbers} />
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
                      
                      <Accordion type="single" collapsible className="w-full text-xs">
                          <AccordionItem value="stock">
                             <AccordionTrigger className='py-2 font-semibold'>Stock & Logistics</AccordionTrigger>
                             <AccordionContent className="space-y-3 pt-2">
                                {product.lastStockChange?.lastCountDateTime && product.lastStockChange?.lastCountDateTime !== 'N/A' ? (
                                    <DataRow
                                        icon={<History />}
                                        label="Last Stock Event"
                                        value={`${product.lastStockChange.inventoryAction} of ${product.lastStockChange.qty} by ${product.lastStockChange.createdBy} at ${product.lastStockChange.lastCountDateTime}`}
                                    />
                                  ) : ( <DataRow icon={<History />} label="Last Stock Event" value="No data available" />)}
                                 <DataRow icon={<Layers />} label="Storage" value={product.productDetails.storage?.join(', ')} />
                                 <DataRow icon={<Layers />} label="Pack Info" value={product.productDetails.packs?.map(p => `${p.packQuantity}x ${p.packNumber}`).join('; ')} />
                                 <DataRow icon={<CalendarClock />} label="Min Life (CPC/CFC)" value={product.productDetails.productLife ? `${product.productDetails.productLife.minimumCPCAcceptanceLife} / ${product.productDetails.productLife.minimumCFCAcceptanceLife} days` : null} />
                                 <DataRow icon={<Flag />} label="Perishable" value={product.productDetails.productFlags?.perishableInd ? 'Yes' : 'No'} />
                                 <DataRow icon={<Flag />} label="Manual Order" value={product.productDetails.manuallyStoreOrderedItem} />
                             </AccordionContent>
                          </AccordionItem>
                          {product.productDetails.commercialHierarchy && (
                             <AccordionItem value="classification">
                                <AccordionTrigger className='py-2 text-xs font-semibold'>Classification</AccordionTrigger>
                                <AccordionContent className="pt-2">
                                   <p className="text-xs">
                                      {
                                        [
                                          product.productDetails.commercialHierarchy.divisionName,
                                          product.productDetails.commercialHierarchy.groupName,
                                          product.productDetails.commercialHierarchy.departmentName,
                                          product.productDetails.commercialHierarchy.className,
                                          product.productDetails.commercialHierarchy.subclassName,
                                        ].filter(Boolean).map(s => s?.replace(/^\d+\s/, '')).join(' → ')
                                      }
                                    </p>
                                </AccordionContent>
                             </AccordionItem>
                          )}
                          { hasBwsDetails && (
                              <AccordionItem value="bws">
                                <AccordionTrigger className='py-2 font-semibold'>Beers, Wines & Spirits</AccordionTrigger>
                                <AccordionContent className="space-y-3 pt-2">
                                  <DataRow icon={<div className='w-5 text-center font-bold'>%</div>} label="ABV" value={bws.alcoholByVolume ? `${bws.alcoholByVolume}%` : null} />
                                  <DataRow icon={<FileText />} label="Tasting Notes" value={bws.tastingNotes} valueClassName='text-xs italic' />
                                  <DataRow icon={<Info />} label="Volume" value={bws.volumeInLitres ? `${bws.volumeInLitres}L` : null} />
                                </AccordionContent>
                              </AccordionItem>
                          )}
                           { (product.productDetails.ingredients && product.productDetails.ingredients.length > 0) && 
                            <AccordionItem value="ingredients">
                                <AccordionTrigger className='py-2 font-semibold'>Ingredients & Allergens</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
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
                                </AccordionContent>
                            </AccordionItem>
                           }
                           {product.productDetails.nutritionalInfo && product.productDetails.nutritionalInfo.length > 0 && (
                            <AccordionItem value="nutrition">
                                <AccordionTrigger className='py-2 font-semibold'>Nutrition</AccordionTrigger>
                                <AccordionContent className="space-y-2 pt-2">
                                    <p className="text-xs text-muted-foreground">{product.productDetails.nutritionalHeading}</p>
                                    <div className='space-y-1 text-xs'>
                                        {product.productDetails.nutritionalInfo
                                            .filter(n => n.name && !n.name.startsWith('*'))
                                            .map(nutrient => (
                                            <div key={nutrient.name} className="flex justify-between border-b pb-1">
                                                <span>{nutrient.name}</span>
                                                <span className="text-right">{nutrient.perComp?.split(',')[0]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                           )}
                      </Accordion>

                      {product.productDetails.productMarketing && <Separator className="my-4" />}
                      {product.productDetails.productMarketing && (
                        <div className='italic text-xs bg-muted/50 p-3 rounded-md'>
                           {product.productDetails.productMarketing}
                        </div>
                      )}

                      <details className="pt-2 text-xs">
                          <summary className="cursor-pointer font-semibold">Raw Data</summary>
                          {product.proxyError && (
                            <div className="my-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-xs">
                                <strong>Proxy Error:</strong> {product.proxyError}
                            </div>
                          )}
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
                isPicker && isPicked && 'opacity-60 scale-95',
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
