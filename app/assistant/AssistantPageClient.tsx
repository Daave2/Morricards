

'use client';

import React, { useEffect, useRef, useState } from 'react';
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
import { Bot, Loader2, Map, ScanLine, X, Truck, CalendarClock, Package, CheckCircle2, Shell, AlertTriangle, ScanSearch, Barcode, Footprints, Tag, Thermometer, Weight, Info, Crown, Globe, GlassWater, FileText, History, Layers, Flag, Leaf, Users, ThumbsUp, Lightbulb, PackageSearch, Search, ChevronDown, DownloadCloud, Send, Beaker } from 'lucide-react';
import type { FetchMorrisonsDataOutput, DeliveryInfo, Order } from '@/lib/morrisons-api';
import { useApiSettings } from '@/hooks/use-api-settings';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { productInsightsFlow, ProductInsightsOutput } from '@/ai/flows/product-insights-flow';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ocrFlow } from '@/ai/flows/ocr-flow';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogDescription, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import SkuQrCode from '@/components/SkuQrCode';
import Link from 'next/link';
import StoreMap, { type ProductLocation } from '@/components/StoreMap';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToastAction } from '@/components/ui/toast';
import { useSearchParams, useRouter } from 'next/navigation';
import SearchComponent from '@/components/assistant/Search';
import type { SearchHit } from '@/lib/morrisonsSearch';
import { productChatFlow } from '@/ai/flows/product-chat-flow';
import type { ChatMessage } from '@/ai/flows/product-chat-types';
import { ScrollArea } from '@/components/ui/scroll-area';


type Product = FetchMorrisonsDataOutput[0];

const FormSchema = z.object({
  sku: z.string().optional(),
});

const LOCAL_STORAGE_KEY_RECENT_AI = 'morricards-assistant-recent';

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
        const adjustedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
        return adjustedDate.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
        });
    };

    let deliveryInfoContent;
    if (deliveryInfo) {
      const friendlyDate = formatDate(deliveryInfo.expectedDate);
      if (deliveryInfo.orderPosition === 'next') {
        deliveryInfoContent = (
          <span><strong>Next delivery due</strong> on <strong>{friendlyDate}</strong> with <strong>{deliveryInfo.totalUnits} units</strong> expected.</span>
        );
      } else {
        deliveryInfoContent = (
          <span><strong>Last delivery was</strong> on <strong>{friendlyDate}</strong>.</span>
        );
      }
    } else {
        deliveryInfoContent = (<span>There are <strong>no upcoming deliveries</strong> scheduled for this item.</span>);
    }

  const hasAllOrders = allOrders && allOrders.length > 0;

  if (hasAllOrders) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="flex items-start gap-3 text-sm cursor-pointer hover:text-foreground/80 p-3 rounded-md -mx-3 transition-colors">
                    <Truck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-grow">{deliveryInfoContent}</div>
                </div>
            </DialogTrigger>
            <DeliveryDetailsModal orders={allOrders} productName={productName} />
        </Dialog>
    )
  }

  return (
    <div className="flex items-start gap-3 text-sm p-3 -mx-3">
        <Truck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-grow">{deliveryInfoContent}</div>
    </div>
  )
}


const InsightSection = ({ title, content, icon, children, variant }: { title: string; content?: React.ReactNode, icon?: React.ReactNode; children?: React.ReactNode, variant?: 'default' | 'destructive' }) => {
  if (!content && !children) return null;

  const contentArray = content && (Array.isArray(content) ? content : [content]);
  if (contentArray && (contentArray.length === 0 || (contentArray.length === 1 && !contentArray[0]))) {
      // If there's no content, only render if there are children
      if (!children) return null;
  }

  const iconColor = variant === 'destructive' ? 'text-destructive' : 'text-primary';

  return (
    <div>
      <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
        {icon ? React.cloneElement(icon as React.ReactElement, { className: `h-5 w-5 ${iconColor}` }) : <Bot className="h-5 w-5 text-primary" />}
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
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};


const ChatInterface = ({ product, locationId }: { product: Product, locationId: string }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if(scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const newUserMessage: ChatMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const result = await productChatFlow({
                productData: product,
                messages: [...messages, newUserMessage],
                locationId,
            });
            const newModelMessage: ChatMessage = { role: 'model', content: result.response };
            setMessages(prev => [...prev, newModelMessage]);
        } catch (error) {
            console.error("Chat flow failed:", error);
            const errorMessage: ChatMessage = { role: 'model', content: "Sorry, I ran into an error. Please try again." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    Chat with Assistant
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-64 pr-4" ref={scrollAreaRef}>
                    <div className="space-y-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={cn("flex items-start gap-3", msg.role === 'user' ? 'justify-end' : '')}>
                                {msg.role === 'model' && (
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback><Bot /></AvatarFallback>
                                    </Avatar>
                                )}
                                <div
                                    className={cn(
                                        "rounded-lg px-4 py-2 text-sm max-w-xs prose prose-sm",
                                        msg.role === 'user'
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                    )}
                                >
                                   {msg.content}
                                </div>
                            </div>
                        ))}
                         {isLoading && (
                            <div className="flex items-start gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback><Bot /></AvatarFallback>
                                </Avatar>
                                <div className="rounded-lg px-4 py-2 text-sm bg-muted flex items-center">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 border-t pt-4 mt-4">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask a question..."
                        disabled={isLoading}
                    />
                    <Button type="submit" disabled={isLoading || !input.trim()}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send />}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

export default function AssistantPageClient() {
  const [isScanMode, setIsScanMode] = useState(false);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [insights, setInsights] = useState<ProductInsightsOutput | null>(null);
  const [recentItems, setRecentItems] = useState<Product[]>([]);
  const [consecutiveFails, setConsecutiveFails] = useState(0);


  const { toast } = useToast();
  const { playSuccess, playError } = useAudioFeedback();
  const { settings, fetchAndUpdateToken, setSettings } = useApiSettings();
  const scannerRef = useRef<{ start: () => void; stop: () => void; getOcrDataUri: () => string | null; } | null>(null);
  
  const searchParams = useSearchParams();
  const router = useRouter();


  useEffect(() => {
    try {
      const savedItems = localStorage.getItem(LOCAL_STORAGE_KEY_RECENT_AI);
      if (savedItems) {
        setRecentItems(JSON.parse(savedItems));
      }
    } catch (error) {
      console.error("Failed to load recent items from local storage", error);
    }
  }, []);

  const updateRecentItems = (newItem: Product) => {
    setRecentItems(prev => {
      const withoutOld = prev.filter(item => item.sku !== newItem.sku);
      const newRecent = [newItem, ...withoutOld].slice(0, 5);
      localStorage.setItem(LOCAL_STORAGE_KEY_RECENT_AI, JSON.stringify(newRecent));
      return newRecent;
    });
  };

  useEffect(() => {
    if (isScanMode) {
      scannerRef.current?.start();
    } else {
      scannerRef.current?.stop();
    }
  }, [isScanMode]);


  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { sku: '' },
  });
  
  // Handle dynamic links from URL params
  useEffect(() => {
    let skuFromUrl = searchParams.get('sku');
    const locationFromUrl = searchParams.get('locationId');

    // If 'sku' param doesn't exist, check for a keyless numeric param
    if (!skuFromUrl) {
      for (const [key, value] of searchParams.entries()) {
        if (!value && /^\d{7,13}$/.test(key)) {
          skuFromUrl = key;
          break;
        }
      }
    }

    if (skuFromUrl) {
      if (locationFromUrl) {
        setSettings({ locationId: locationFromUrl });
      }
      fetchProductAndInsights(skuFromUrl);
      // Clean the URL to avoid re-triggering on refresh
      router.replace('/assistant', undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleReset = () => {
    setProduct(null);
    setInsights(null);
  }

  const fetchProductAndInsights = async (sku: string) => {
    if (!sku || sku.trim().length < 4) {
        toast({ variant: 'destructive', title: 'Invalid SKU', description: 'Please enter a valid SKU or EAN.' });
        return;
    }
    setIsFetchingProduct(true);
    handleReset();

    const { locationId } = settings;
    if (!locationId) {
      playError();
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a store location ID in settings.' });
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
      const newFailCount = consecutiveFails + 1;
      setConsecutiveFails(newFailCount);
      let toastAction;
      if (newFailCount >= 2) {
          toastAction = (
              <ToastAction altText="Fetch Latest?" onClick={fetchAndUpdateToken}>
                   <DownloadCloud className="mr-2 h-4 w-4" />
                   Fetch Latest?
              </ToastAction>
          )
      }
      toast({ 
        variant: 'destructive', 
        title: 'Product Not Found', 
        description: newFailCount >= 2 ? `Lookup failed again. Your token may have expired.` : `Could not find product data for EAN/SKU: ${sku}`,
        action: toastAction,
      });

    } else {
      setConsecutiveFails(0); // Reset on success
      playSuccess();
      const foundProduct = data[0];
      setProduct(foundProduct);
      updateRecentItems(foundProduct);
      toast({ title: 'Product Found', description: `Generating AI insights for ${foundProduct.name}...` });
      form.setValue('sku', '');

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


  const handleScanSuccess = async (text: string) => {
    const sku = text.split(',')[0].trim();
    if (!sku) return;
    setIsScanMode(false);
    await fetchProductAndInsights(sku);
  };
  
  const handleScanError = (message: string) => {
    const lowerMessage = message.toLowerCase();
    if (!lowerMessage.includes('not found') && !lowerMessage.includes('no multiformat readers')) {
      toast({ variant: 'destructive', title: 'Scanner Error', description: message });
    }
  };

   const handleOcrRequest = async () => {
    if (!scannerRef.current) return;
    const imageDataUri = scannerRef.current.getOcrDataUri();
    if (!imageDataUri) return;

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

  const handleSearchPick = (hit: SearchHit) => {
    if (hit.retailerProductId) {
      handleReset(); // Clear current product view before fetching new one
      fetchProductAndInsights(hit.retailerProductId);
    } else {
      toast({
        variant: 'destructive',
        title: 'Selection Error',
        description: 'The selected product does not have a valid ID to look up.'
      })
    }
  }

  const bws = product?.productDetails?.beersWinesSpirits;
  const hasBwsDetails = bws && (bws.alcoholByVolume || bws.tastingNotes || bws.volumeInLitres);
  const productLocation = product ? parseLocationString(product.location.standard) : null;

  return (
    <div className="min-h-screen">
      {isScanMode && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsScanMode(false)}
          />
          <div
            className={cn(
              'fixed bottom-4 inset-x-4 z-50 p-4 space-y-4 max-w-md mx-auto',
              'rounded-2xl border shadow-xl',
              'bg-background',
              'theme-glass:bg-black/30 theme-glass:border-white/20 theme-glass:backdrop-blur-xl'
            )}
          >
            <ZXingScanner
              ref={scannerRef}
              onResult={handleScanSuccess}
              onError={handleScanError}
            />
            <Button onClick={handleOcrRequest} disabled={isOcrLoading} className="w-full">
              {isOcrLoading ? <Loader2 className="animate-spin" /> : <ScanSearch />}
              {isOcrLoading ? 'Reading...' : 'Read with AI'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsScanMode(false)}
              className="absolute top-2 right-2 z-10 rounded-full bg-background/50 hover:bg-background/80"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 md:py-12">
        <Card className="max-w-2xl mx-auto mb-8">
          <CardHeader>
            <CardTitle>AI Product Assistant</CardTitle>
            <CardDescription>Search for a product by name or SKU/EAN, or scan its barcode to get details and AI-powered insights.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-4">
                <SearchComponent onPick={handleSearchPick} onClear={() => handleReset()} />
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => setIsScanMode(true)}
                  disabled={isFetchingProduct || isGeneratingInsights}
                  variant="outline"
                >
                  <ScanLine className="mr-2 h-4 w-4" />
                  Or Scan Product Barcode
                </Button>
            </div>

          </CardContent>
        </Card>

        {isFetchingProduct && (
          <div className="text-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Looking up product...</p>
          </div>
        )}

        {product && (
          <div className="max-w-2xl mx-auto mb-12 animate-in fade-in-50">
            <Card>
                <CardHeader>
                <div className='flex items-start gap-4'>
                    <div className={cn("rounded-lg p-2", "border theme-glass:border-white/20 theme-glass:bg-white/10 theme-glass:backdrop-blur-xl")}>
                        <Image
                            src={product.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'}
                            alt={product.name}
                            width={100}
                            height={100}
                            className="rounded-md object-cover"
                        />
                    </div>
                    <div className='flex-grow'>
                        <CardTitle>{product.name}</CardTitle>
                        <CardDescription>SKU: {product.sku} | Stock: {product.stockQuantity}</CardDescription>
                        {(product.price.promotional || product.price.regular) && (
                            <div className="mt-2 flex items-baseline gap-2">
                                <Badge className="text-lg" variant={product.price.promotional ? 'destructive' : 'secondary'}>
                                    {product.price.promotional || `£${product.price.regular?.toFixed(2)}`}
                                </Badge>
                                {product.price.promotional && product.price.regular && (
                                    <span className="text-sm text-muted-foreground line-through">
                                        £{product.price.regular.toFixed(2)}
                                    </span>
                                )}
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
                       <div className="space-y-6">
                        <InsightSection title="About This Product" icon={<Info />} content={insights.customerFacingSummary} />
                        <InsightSection title="Where to Find It" icon={<Map />} content={insights.customerFriendlyLocation}>
                           {productLocation && (
                              <Collapsible open={isMapOpen} onOpenChange={setIsMapOpen}>
                                <CollapsibleTrigger asChild>
                                    <Button variant="outline" className="w-full">
                                        <Map className="mr-2 h-4 w-4" />
                                        {isMapOpen ? 'Hide Map' : 'Show Map'}
                                        <ChevronDown className={cn("h-4 w-4 ml-2 transition-transform", isMapOpen && "rotate-180")} />
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="w-full border rounded-lg bg-card/80 backdrop-blur-sm shadow-lg overflow-x-auto mt-4">
                                      <StoreMap productLocations={productLocation ? [{ sku: product.sku, location: productLocation }] : []} />
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                           )}
                        </InsightSection>
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>More AI Insights</AccordionTrigger>
                                <AccordionContent className="space-y-6 pt-4">
                                    <InsightSection title="Key Selling Points" icon={<ThumbsUp />} content={insights.sellingPoints} />
                                    <InsightSection title="Recipe Ideas" icon={<Lightbulb />} content={insights.recipeIdeas} />
                                    <InsightSection title="Allergens" icon={<Shell />} content={insights.allergens} variant={insights.allergens?.includes('None listed') ? 'default' : 'destructive'} />
                                    <InsightSection title="Ideal Customer" icon={<Users />} content={insights.customerProfile} />
                                    <InsightSection title="Placement Notes" icon={<Lightbulb />} content={insights.placementNotes} />
                                    <InsightSection title="Where to Find Cross-Sell Items" icon={<Map />}>
                                       <div className="text-sm prose prose-sm max-w-none">
                                          <ul className="list-disc pl-5 space-y-1">
                                              {insights.crossSell?.map((item, index) => <li key={index}>{item}</li>)}
                                          </ul>
                                       </div>
                                    </InsightSection>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2">
                                <AccordionTrigger>Full Product Details</AccordionTrigger>
                                <AccordionContent className="pt-4 text-sm text-muted-foreground">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <DataRow icon={<Barcode />} label="SKU" value={`${product.sku} (EAN: ${product.scannedSku}) ${product.stockSkuUsed ? `(Stock SKU: ${product.stockSkuUsed})` : ''}`} />
                                            <DataRow icon={<Info />} label="Status" value={product.status} />
                                            <DataRow icon={<Footprints />} label="Walk Sequence" value={product.productDetails.legacyItemNumbers} />
                                            <DataRow icon={<Tag />} label="Promo Location" value={product.location.promotional} />
                                            <DataRow icon={<Crown />} label="Brand" value={product.productDetails.brand} />
                                            <DataRow icon={<Globe />} label="Country of Origin" value={product.productDetails.countryOfOrigin} />
                                            <DataRow icon={<Thermometer />} label="Temperature" value={product.temperature} />
                                            <DataRow icon={<Weight />} label="Weight" value={product.weight ? `${product.weight} kg` : null} />
                                            <div className='sm:col-span-2'>
                                                <Button variant="outline" size="sm" className="w-full" asChild>
                                                <Link href={`/map?sku=${product.sku}&locationId=${settings.locationId}`}>
                                                    <Map className="mr-2 h-4 w-4" />
                                                    View on Map
                                                </Link>
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex justify-center py-2">
                                            <SkuQrCode sku={product.sku} />
                                        </div>

                                        <Accordion type="single" collapsible className="w-full text-xs">
                                            <AccordionItem value="stock">
                                                <AccordionTrigger className='py-2 font-semibold'>Stock & Logistics</AccordionTrigger>
                                                <AccordionContent className="space-y-3 pt-2">
                                                {product.lastStockChange?.lastCountDateTime && (
                                                    <DataRow
                                                        icon={<History />}
                                                        label="Last Stock Event"
                                                        value={`${product.lastStockChange.inventoryAction} of ${product.lastStockChange.qty} by ${product.lastStockChange.createdBy} at ${product.lastStockChange.lastCountDateTime}`}
                                                    />
                                                    )}
                                                    <DataRow icon={<Layers />} label="Storage" value={product.productDetails.storage?.join(', ')} />
                                                    <DataRow icon={<Layers />} label="Pack Info" value={product.productDetails.packs?.map(p => `${p.packQuantity}x ${p.packNumber}`).join('; ')} />
                                                    <DataRow icon={<CalendarClock />} label="Min Life (CPC/CFC)" value={product.productDetails.productLife ? `${product.productDetails.productLife.minimumCPCAcceptanceLife} / ${product.productDetails.productLife.minimumCFCAcceptanceLife} days` : null} />
                                                    <DataRow icon={<Flag />} label="Perishable" value={product.productDetails.productFlags?.perishableInd ? 'Yes' : 'No'} />
                                                    <DataRow icon={<Flag />} label="Manual Order" value={product.productDetails.manuallyStoreOrderedItem} />
                                                     <DataRow icon={<Info />} label="Start of Day Stock" value={product.spaceInfo?.startOfDayQty} />
                                                    <DataRow icon={<Info />} label="End of Day Stock" value={product.spaceInfo?.endOfDayQty} />
                                                    <DataRow icon={<Info />} label="Facings" value={product.spaceInfo?.standardSpace?.locations?.[0]?.facings} />
                                                    <DataRow icon={<Info />} label="Fill Quantity" value={product.spaceInfo?.standardSpace?.locations?.[0]?.fillQty} />
                                                    <DataRow icon={<Info />} label="Merch Type" value={product.spaceInfo?.standardSpace?.locations?.[0]?.merchandiseType} />
                                                </AccordionContent>
                                            </AccordionItem>
                                             {product.productDetails.commercialHierarchy && (
                                                <AccordionItem value="classification">
                                                    <AccordionTrigger className='py-2 text-xs font-semibold'>Classification</AccordionTrigger>
                                                    <AccordionContent className="pt-2">
                                                    <p className="text-xs">
                                                        {[
                                                            product.productDetails.commercialHierarchy.divisionName,
                                                            product.productDetails.commercialHierarchy.groupName,
                                                            product.productDetails.commercialHierarchy.departmentName,
                                                            product.productDetails.commercialHierarchy.className,
                                                            product.productDetails.commercialHierarchy.subclassName,
                                                        ].filter(Boolean).map(s => s?.replace(/^\d+\s/, '')).join(' → ')}
                                                    </p>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            )}
                                            {hasBwsDetails && (
                                                <AccordionItem value="bws">
                                                    <AccordionTrigger className='py-2 font-semibold'>Beers, Wines & Spirits</AccordionTrigger>
                                                    <AccordionContent className="space-y-3 pt-2">
                                                    <DataRow icon={<div className='w-5 text-center font-bold'>%</div>} label="ABV" value={bws.alcoholByVolume ? `${bws.alcoholByVolume}%` : null} />
                                                    <DataRow icon={<FileText />} label="Tasting Notes" value={bws.tastingNotes} valueClassName="text-xs italic" />
                                                    <DataRow icon={<Info />} label="Volume" value={bws.volumeInLitres ? `${bws.volumeInLitres}L` : null} />
                                                    </AccordionContent>
                                                </AccordionItem>
                                            )}
                                            {(product.productDetails.ingredients && product.productDetails.ingredients.length > 0) &&
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
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        <ChatInterface product={product} locationId={settings.locationId} />
                       </div>
                    )}

                    {!isGeneratingInsights && !insights && product && (
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

        {recentItems.length > 0 && !product && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-4">Recently Viewed</h2>
            <div className="space-y-4">
              {recentItems.map((item, i) => (
                <Card
                  key={item.sku}
                  className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-shadow animate-in fade-in-50"
                  style={{ animationDelay: `${i * 100}ms` }}
                  onClick={() => fetchProductAndInsights(item.sku)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={cn("rounded-lg p-2", "border theme-glass:border-white/20 theme-glass:bg-white/10 theme-glass:backdrop-blur-xl")}>
                        <Image
                          src={item.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'}
                          alt={item.name}
                          width={80}
                          height={80}
                          className="rounded-md object-cover"
                          data-ai-hint="product image small"
                        />
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                        {(item.price.promotional || item.price.regular) && (
                            <div className="mt-2 flex items-baseline gap-2">
                                <Badge variant={item.price.promotional ? 'destructive' : 'secondary'}>
                                    {item.price.promotional || `£${item.price.regular?.toFixed(2)}`}
                                </Badge>
                                {item.price.promotional && item.price.regular && (
                                    <span className="text-xs text-muted-foreground line-through">
                                        £{item.price.regular.toFixed(2)}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!product && !isFetchingProduct && recentItems.length === 0 && (
          <Card>
              <CardContent className="p-12 text-center">
                  <Bot className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Search or scan a product to get started with the AI assistant.</p>
              </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
