
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useAudioFeedback } from '@/hooks/use-audio-feedback';
import ZXingScanner from '@/components/ZXingScanner';
import { Bot, ChevronLeft, Loader2, MapPin, ScanLine, Sparkles, User, X, ShoppingCart, ChefHat, Map, Expand, Truck, CalendarClock, Package, CheckCircle2 } from 'lucide-react';
import type { FetchMorrisonsDataOutput, DeliveryInfo, Order } from '@/lib/morrisons-api';
import { useApiSettings } from '@/hooks/use-api-settings';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { productInsightsFlow, ProductInsightsOutput } from '@/ai/flows/product-insights-flow';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ocrFlow } from '@/ai/flows/ocr-flow';
import StoreMap, { type ProductLocation } from '@/components/StoreMap';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogDescription, DialogTrigger, DialogTitle } from '@/components/ui/dialog';

type Product = FetchMorrisonsDataOutput[0];

const FormSchema = z.object({
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
});

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

const DataRow = ({ icon, label, value, valueClassName }: { icon: React.ReactNode, label: string, value?: string | number | null | React.ReactNode, valueClassName?: string }) => {
    if (value === undefined || value === null || value === '') return null;
    return (
        <div className="flex items-start gap-3">
            <div className="w-5 h-5 text-muted-foreground flex-shrink-0 pt-0.5">{icon}</div>
            <div className='flex-grow min-w-0'>
                <span className="font-bold">{label}:</span> <span className={'break-words'}>{value}</span>
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
        {orders.length > 0 ? orders.map(order => (
          <Card key={order.orderId}>
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
                <DataRow icon={<CalendarClock/>} label="Expected Delivery" value={order.delivery?.dateDeliveryExpected ? new Date(order.delivery.dateDeliveryExpected).toLocaleDateString() : 'N/A'} />
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
        )) : <p>No delivery history found.</p>}
      </div>
    </DialogContent>
  )
}

const DeliveryInfoRow = ({ deliveryInfo, allOrders, productName }: { deliveryInfo?: DeliveryInfo | null, allOrders?: Order[] | null, productName: string }) => {
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const adjustedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
        return adjustedDate.toLocaleDateString('en-GB', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short', 
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
                <div className="flex items-center gap-3 text-sm cursor-pointer hover:underline p-3 rounded-md hover:bg-muted -mx-3">
                    <Truck className="h-5 w-5 text-primary" />
                    {deliveryInfoContent}
                </div>
            </DialogTrigger>
            <DeliveryDetailsModal orders={allOrders} productName={productName} />
        </Dialog>
    )
  }

  return (
    <div className="flex items-center gap-3 text-sm p-3 -mx-3">
        <Truck className="h-5 w-5 text-primary" />
        {deliveryInfoContent}
    </div>
  )
}


const InsightSection = ({ title, content, icon, children }: { title: string; content?: React.ReactNode, icon?: React.ReactNode; children?: React.ReactNode }) => {
  if (!content && !children) return null;
  
  const contentArray = content && (Array.isArray(content) ? content : [content]);
  if (contentArray && (contentArray.length === 0 || (contentArray.length === 1 && !contentArray[0]))) return null;

  return (
    <div>
      <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
        {icon || <Sparkles className="h-5 w-5 text-primary" />}
        {title}
      </h3>
      <div className="text-sm prose prose-sm max-w-none">
          {content && (Array.isArray(content) ? (
            <ul className="list-disc pl-5 space-y-1">
                {content.map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ul>
        ) : (
            <p>{content}</p>
        ))}
      </div>
      {children}
    </div>
  );
};

export default function AssistantPage() {
  const [isScanMode, setIsScanMode] = useState(false);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [productLocation, setProductLocation] = useState<ProductLocation | null>(null);
  const [insights, setInsights] = useState<ProductInsightsOutput | null>(null);

  const { toast } = useToast();
  const { playSuccess, playError } = useAudioFeedback();
  const { settings } = useApiSettings();
  const scannerRef = useRef<{ start: () => void; stop: () => void; } | null>(null);

  useEffect(() => {
    if (isScanMode) {
      scannerRef.current?.start();
    } else {
      scannerRef.current?.stop();
    }
  }, [isScanMode]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { locationId: '218' },
  });

  const handleScanSuccess = async (text: string) => {
    const sku = text.split(',')[0].trim();
    if (!sku) return;

    setIsScanMode(false);
    setIsFetchingProduct(true);
    setProduct(null);
    setInsights(null);
    setProductLocation(null);

    const locationId = form.getValues('locationId');
    if (!locationId) {
      playError();
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a store location ID.' });
      setIsFetchingProduct(false);
      return;
    }

    const { data, error } = await getProductData({
      locationId,
      skus: [sku],
      bearerToken: settings.bearerToken,
      debugMode: settings.debugMode,
    });

    setIsFetchingProduct(false);

    if (error || !data || data.length === 0) {
      playError();
      toast({ variant: 'destructive', title: 'Product Not Found', description: `Could not find product data for EAN/SKU: ${sku}` });
    } else {
      playSuccess();
      const foundProduct = data[0];
      setProduct(foundProduct);
      setProductLocation(parseLocationString(foundProduct.location.standard));
      toast({ title: 'Product Found', description: `Generating AI insights for ${foundProduct.name}...` });
      
      setIsGeneratingInsights(true);
      try {
        const insightResult = await productInsightsFlow({ productData: foundProduct });
        setInsights(insightResult);
      } catch (e) {
        console.error("Insight generation failed:", e);
        toast({ variant: 'destructive', title: 'AI Error', description: 'Could not generate product insights.' });
      } finally {
        setIsGeneratingInsights(false);
      }
    }
  };

  const handleScanError = (message: string) => {
    const lowerMessage = message.toLowerCase();
    if (!lowerMessage.includes('not found') && !lowerMessage.includes('no multiformat readers')) {
      toast({ variant: 'destructive', title: 'Scanner Error', description: message });
    }
  };

   const handleOcrRequest = async (imageDataUri: string) => {
    setIsOcrLoading(true);
    toast({ title: 'AI OCR', description: 'Reading numbers from the label...' });
    try {
        const result = await ocrFlow({ imageDataUri });
        if (result.eanOrSku) {
            toast({ title: 'AI OCR Success', description: `Found number: ${result.eanOrSku}` });
            await handleScanSuccess(result.eanOrSku);
        } else {
            playError();
            toast({ variant: 'destructive', title: 'AI OCR Failed', description: 'Could not find a valid SKU or EAN on the label.' });
        }
    } catch (e) {
        console.error("OCR flow failed", e);
        playError();
        toast({ variant: 'destructive', title: 'AI OCR Error', description: 'An error occurred while reading the image.' });
    } finally {
        setIsOcrLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-background">
      {isScanMode && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md mx-auto relative p-0 pt-10">
            <ZXingScanner
              ref={scannerRef}
              onResult={handleScanSuccess}
              onError={handleScanError}
              onOcrRequest={handleOcrRequest}
              isOcrLoading={isOcrLoading}
            />
            <Button variant="ghost" size="icon" onClick={() => setIsScanMode(false)} className="absolute top-2 right-2 z-10 bg-black/20 hover:bg-black/50 text-white hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-primary">AI Product Assistant</h1>
          <p className="mt-2 text-lg text-muted-foreground max-w-2xl mx-auto">
            Scan any product to get instant, intelligent insights and selling points.
          </p>
        </header>

        <Card className="max-w-2xl mx-auto mb-8 shadow-md">
          <CardContent className="p-4">
            <Form {...form}>
              <form className="flex flex-col sm:flex-row items-end gap-4">
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem className="w-full sm:w-auto sm:flex-grow">
                      <FormLabel>Store ID</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 218" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  className="w-full sm:w-auto flex-shrink-0"
                  onClick={() => setIsScanMode(true)}
                  disabled={isFetchingProduct || isGeneratingInsights}
                >
                  <ScanLine className="mr-2 h-4 w-4" />
                  Scan Product
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {isFetchingProduct && (
          <div className="text-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Looking up product...</p>
          </div>
        )}

        {product && (
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-lg">
                <CardHeader>
                <div className='flex items-start gap-4'>
                    <Image
                        src={product.imageUrl || 'https://placehold.co/100x100.png'}
                        alt={product.name}
                        width={100}
                        height={100}
                        className="rounded-lg border object-cover"
                    />
                    <div className='flex-grow'>
                        <CardTitle>{product.name}</CardTitle>
                        <CardDescription>SKU: {product.sku} | Stock: {product.stockQuantity}</CardDescription>
                        {insights?.price && (
                            <div className="mt-2">
                            <Badge className="text-lg" variant="secondary">{insights.price}</Badge>
                            </div>
                        )}
                         <div className="mt-2">
                            <DeliveryInfoRow deliveryInfo={product.deliveryInfo} allOrders={product.allOrders} productName={product.name} />
                        </div>
                    </div>
                </div>
                </CardHeader>
                <CardContent className='space-y-6'>
                    {isGeneratingInsights && (
                        <div className='flex items-center gap-4 p-4 bg-muted/50 rounded-lg'>
                            <Avatar>
                                <AvatarFallback><Bot /></AvatarFallback>
                            </Avatar>
                            <div className='space-y-2'>
                            <p className='font-medium'>Generating insights...</p>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        </div>
                    )}
                    {insights && (
                        <div className='flex items-start gap-4 p-4 bg-muted/50 rounded-lg'>
                            <Avatar>
                                <AvatarFallback className="bg-primary text-primary-foreground"><Bot /></AvatarFallback>
                            </Avatar>
                            <div className='flex-grow space-y-4 text-sm'>
                                <InsightSection title="About this product" content={insights.customerFacingSummary} />
                                <InsightSection
                                  title="Where to find it"
                                  icon={<MapPin className="h-5 w-5 text-primary" />}
                                  content={insights.customerFriendlyLocation}
                                >
                                  {productLocation && (
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <div className="mt-4 border rounded-lg bg-card overflow-hidden cursor-pointer group relative">
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                                            <Expand className="h-8 w-8 text-white" />
                                          </div>
                                          <div className="overflow-x-auto">
                                            <StoreMap productLocation={productLocation} />
                                          </div>
                                        </div>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-4xl p-2">
                                        <StoreMap productLocation={productLocation} />
                                      </DialogContent>
                                    </Dialog>
                                  )}
                                </InsightSection>

                                <InsightSection
                                  title="Key Selling Points"
                                  content={insights.sellingPoints ?? []}
                                />
                                <InsightSection
                                  title="Ideal Customer"
                                  content={insights.customerProfile ?? ''}
                                />
                                <InsightSection
                                  title="Placement Notes"
                                  content={insights.placementNotes ?? ''}
                                />

                                {insights.crossSell && insights.crossSell.length > 0 && (
                                    <InsightSection
                                    title="You might also like..."
                                    icon={<ShoppingCart className="h-5 w-5 text-primary" />}
                                    content={insights.crossSell}
                                    />
                                )}
                                {insights.recipeIdeas && insights.recipeIdeas.length > 0 && (
                                    <InsightSection
                                    title="Recipe Ideas"
                                    icon={<ChefHat className="h-5 w-5 text-primary" />}
                                    content={insights.recipeIdeas}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {!isGeneratingInsights && !insights && (
                        <Alert variant="destructive">
                            <Bot className="h-4 w-4" />
                            <AlertTitle>Insights Failed</AlertTitle>
                            <AlertDescription>
                                The AI assistant could not generate insights for this product. Please try again.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
          </div>
        )}

        {!product && !isFetchingProduct && (
            <Card className="max-w-2xl mx-auto shadow-lg border-dashed">
                <CardContent className="p-12 text-center">
                    <Bot className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Scan a product to begin your conversation with the AI assistant.</p>
                </CardContent>
            </Card>
        )}
      </main>
    </div>
  );
}
