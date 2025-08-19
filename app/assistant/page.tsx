
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
import { Bot, Loader2, MapPin, ScanLine, Sparkles, X, ShoppingCart, ChefHat, Map, Expand, Truck, CalendarClock, Package, CheckCircle2, Shell, AlertTriangle, ScanSearch, User, ChevronDown, Barcode, Footprints, Tag, Thermometer, Weight, Info, Crown, Globe, GlassWater, FileText, History, Layers, Flag, Leaf, Users, Target, ThumbsUp, Lightbulb } from 'lucide-react';
import type { FetchMorrisonsDataOutput, DeliveryInfo, Order } from '@/lib/morrisons-api';
import { useApiSettings } from '@/hooks/use-api-settings';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { productInsightsFlow, ProductInsightsOutput } from '@/ai/flows/product-insights-flow';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ocrFlow } from '@/ai/flows/ocr-flow';
import StoreMap, { type ProductLocation } from '@/components/StoreMap';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogDescription, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import SkuQrCode from '@/components/SkuQrCode';
import { cn } from '@/lib/utils';
import { productChatFlow } from '@/ai/flows/product-chat-flow';
import type { ChatMessage } from '@/ai/flows/product-chat-types';


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

const DataRow = ({ icon, label, value }: { icon: React.ReactNode, label: string, value?: string | number | null | React.ReactNode }) => {
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
                <div className="flex items-start gap-3 text-sm cursor-pointer hover:underline p-3 rounded-md hover:bg-muted -mx-3">
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
  if (contentArray && (contentArray.length === 0 || (contentArray.length === 1 && !contentArray[0]))) return null;
  
  const iconColor = variant === 'destructive' ? 'text-destructive' : 'text-primary';

  return (
    <div>
      <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
        {icon ? React.cloneElement(icon as React.ReactElement, { className: `h-5 w-5 ${iconColor}` }) : <Sparkles className="h-5 w-5 text-primary" />}
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

const ChatInputSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty.'),
});

export default function AssistantPage() {
  const [isScanMode, setIsScanMode] = useState(false);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  
  const [product, setProduct] = useState<Product | null>(null);
  const [productLocation, setProductLocation] = useState<ProductLocation | null>(null);
  const [insights, setInsights] = useState<ProductInsightsOutput | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  
  const { toast } = useToast();
  const { playSuccess, playError } = useAudioFeedback();
  const { settings } = useApiSettings();
  const scannerRef = useRef<{ start: () => void; stop: () => void; getOcrDataUri: () => string | null; } | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const chatForm = useForm<z.infer<typeof ChatInputSchema>>({
    resolver: zodResolver(ChatInputSchema),
    defaultValues: { message: '' },
  });
  
  useEffect(() => {
    if (isScanMode) {
      scannerRef.current?.start();
    } else {
      scannerRef.current?.stop();
    }
  }, [isScanMode]);

   useEffect(() => {
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { locationId: '218' },
  });

  const handleReset = () => {
    setProduct(null);
    setInsights(null);
    setProductLocation(null);
    setMessages([]);
  }

  const handleScanSuccess = async (text: string) => {
    const sku = text.split(',')[0].trim();
    if (!sku) return;

    setIsScanMode(false);
    setIsFetchingProduct(true);
    handleReset();

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
         if (insightResult.customerFacingSummary) {
          setMessages([{ role: 'model', content: insightResult.customerFacingSummary }]);
        }
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
  
  const handleChatSubmit = async (values: z.infer<typeof ChatInputSchema>) => {
    if (!product) return;

    const userMessage: ChatMessage = { role: 'user', content: values.message };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    chatForm.reset();
    setIsThinking(true);

    try {
      const result = await productChatFlow({
        productData: product,
        messages: newMessages,
        locationId: form.getValues('locationId'),
      });
      const modelMessage: ChatMessage = { role: 'model', content: result.response };
      setMessages(prev => [...prev, modelMessage]);
    } catch (e) {
      console.error('Chat flow error:', e);
      const errorMessage: ChatMessage = {
        role: 'model',
        content: "Sorry, I encountered an error and couldn't process your request.",
      };
      setMessages(prev => [...prev, errorMessage]);
      toast({
        variant: 'destructive',
        title: 'Chat Error',
        description: 'Could not get a response from the AI assistant.',
      });
    } finally {
      setIsThinking(false);
    }
  };

  const bws = product?.productDetails?.beersWinesSpirits;
  const hasBwsDetails = bws && (bws.alcoholByVolume || bws.tastingNotes || bws.volumeInLitres);

  return (
    <div className="min-h-screen bg-background">
      {isScanMode && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md mx-auto relative p-0 space-y-4">
            <ZXingScanner
              ref={scannerRef}
              onResult={handleScanSuccess}
              onError={handleScanError}
            />
          </div>
           <div className="mt-4 w-full max-w-md">
            <Button onClick={handleOcrRequest} disabled={isOcrLoading} className="w-full" size="lg">
              {isOcrLoading ? ( <Loader2 className="animate-spin" /> ) : ( <ScanSearch /> )}
              {isOcrLoading ? 'Reading...' : 'Read with AI'}
            </Button>
          </div>
            <Button variant="ghost" size="icon" onClick={() => setIsScanMode(false)} className="absolute top-4 right-4 z-10 bg-black/20 hover:bg-black/50 text-white hover:text-white">
              <X className="h-6 w-6" />
            </Button>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 md:py-12">
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
                        src={product.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'}
                        alt={product.name}
                        width={100}
                        height={100}
                        className="rounded-lg border object-cover"
                    />
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
                       <>
                        <div className="space-y-4">
                            <div ref={chatContainerRef} className="max-h-[50vh] overflow-y-auto pr-4 -mr-4 space-y-4">
                                {messages.map((message, index) => (
                                    <div key={index} className={cn('flex items-start gap-4', message.role === 'user' && 'justify-end')}>
                                        {message.role === 'model' && (
                                            <Avatar>
                                                <AvatarFallback className="bg-primary text-primary-foreground"><Bot /></AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div className={cn(
                                            'rounded-lg px-4 py-3 text-sm max-w-lg', 
                                            message.role === 'model' ? 'bg-muted/50' : 'bg-primary text-primary-foreground'
                                        )}>
                                            <p className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br />') }} />
                                        </div>
                                         {message.role === 'user' && (
                                            <Avatar>
                                                <AvatarFallback><User /></AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ))}
                                {isThinking && (
                                    <div className="flex items-start gap-4">
                                        <Avatar>
                                            <AvatarFallback className="bg-primary text-primary-foreground"><Bot /></AvatarFallback>
                                        </Avatar>
                                        <div className="rounded-lg px-4 py-3 text-sm bg-muted/50 flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Thinking...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Form {...chatForm}>
                                <form onSubmit={chatForm.handleSubmit(handleChatSubmit)} className="flex items-center gap-2">
                                    <FormField
                                        control={chatForm.control}
                                        name="message"
                                        render={({ field }) => (
                                            <FormItem className="flex-grow">
                                                <FormControl>
                                                    <Input placeholder="Ask a follow-up question..." {...field} disabled={isThinking} autoComplete="off" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" disabled={isThinking}>
                                        Send
                                    </Button>
                                </form>
                            </Form>
                        </div>
                        <Accordion type="single" collapsible className="w-full" defaultValue='item-1'>
                            <AccordionItem value="item-1">
                                <AccordionTrigger>More AI Insights</AccordionTrigger>
                                <AccordionContent className="space-y-6 pt-4">
                                    <InsightSection title="Key Selling Points" icon={<ThumbsUp />} content={insights.sellingPoints} />
                                    <InsightSection title="Recipe Ideas" icon={<ChefHat />} content={insights.recipeIdeas} />
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
                        </Accordion>
                       </>
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

    