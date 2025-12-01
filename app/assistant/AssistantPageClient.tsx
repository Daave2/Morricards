
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import { Bot, Loader2, Map, ScanLine, X, Truck, CalendarClock, Package, CheckCircle2, Shell, AlertTriangle, ScanSearch, Barcode, Footprints, Tag, Thermometer, Weight, Info, Crown, Globe, GlassWater, FileText, History, Layers, Flag, Leaf, Users, ThumbsUp, Lightbulb, PackageSearch, Search, ChevronDown, DownloadCloud, Send, ShoppingBasket, Link as LinkIcon, Expand, Sparkles } from 'lucide-react';
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
import type { components } from '@/morrisons-types';
import ImageModal from '@/components/image-modal';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';


type BaseProduct = FetchMorrisonsDataOutput[0];
type FullProduct = components['schemas']['Product'];

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
                <DataRow icon={<CalendarClock />} label="Expected Delivery" value={expectedDate ? new Date(expectedDate).toLocaleDateString() : 'N/A'} />
                {order.lines?.status?.map((s, i) => (
                  <div key={i} className="pl-4 border-l-2 ml-2 space-y-2">
                    {s.ordered && (
                      <div>
                        <p className="font-semibold">Ordered</p>
                        <DataRow icon={<Package />} label="Quantity" value={`${s.ordered.quantity} ${s.ordered.quantityType}(s)`} />
                        <DataRow icon={<CalendarClock />} label="Date" value={s.ordered.date ? new Date(s.ordered.date).toLocaleDateString() : 'N/A'} />
                      </div>
                    )}
                    {s.receipted && (
                      <div>
                        <p className="font-semibold">Receipted</p>
                        <DataRow icon={<CheckCircle2 />} label="Quantity" value={`${s.receipted.quantity} ${s.receipted.quantityType}(s)`} />
                        <DataRow icon={<CalendarClock />} label="Date" value={s.receipted.date ? new Date(s.receipted.date).toLocaleString() : 'N/A'} />
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
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
    </motion.div>
  );
};


const ChatInterface = ({ product, locationId }: { product: BaseProduct, locationId: string }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

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
    <Card className="mt-6 overflow-hidden">
      <CardHeader className="bg-muted/30 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Chat with Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[350px] p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={cn("flex items-start gap-3", msg.role === 'user' ? 'justify-end' : '')}
                >
                  {msg.role === 'model' && (
                    <Avatar className="h-8 w-8 mt-1 border shadow-sm">
                      <AvatarFallback className="bg-primary/10 text-primary"><Bot className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm max-w-[85%]",
                      msg.role === 'user'
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted/80 backdrop-blur-sm rounded-bl-none border"
                    )}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3"
              >
                <Avatar className="h-8 w-8 mt-1 border shadow-sm">
                  <AvatarFallback className="bg-primary/10 text-primary"><Bot className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div className="rounded-2xl rounded-bl-none px-4 py-3 text-sm bg-muted/80 backdrop-blur-sm border flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Thinking</span>
                  <span className="flex gap-1">
                    <motion.span
                      className="w-1 h-1 bg-muted-foreground rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                    />
                    <motion.span
                      className="w-1 h-1 bg-muted-foreground rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    />
                    <motion.span
                      className="w-1 h-1 bg-muted-foreground rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                    />
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>
        <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about this product..."
              disabled={isLoading}
              className="rounded-full bg-muted/50 border-muted-foreground/20 focus-visible:ring-offset-0"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="rounded-full h-10 w-10 shrink-0">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}

const ProductSkeleton = () => (
  <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
    <div className="flex gap-4">
      <Skeleton className="h-[100px] w-[100px] rounded-lg" />
      <div className="flex-grow space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-8 w-24 mt-2" />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
    </div>
  </div>
);

export default function AssistantPageClient({ skuFromPath }: { skuFromPath?: string }) {
  const [isScanMode, setIsScanMode] = useState(false);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  const [product, setProduct] = useState<BaseProduct | null>(null);
  const [insights, setInsights] = useState<ProductInsightsOutput | null>(null);
  const [recentItems, setRecentItems] = useState<BaseProduct[]>([]);
  const [consecutiveFails, setConsecutiveFails] = useState(0);


  const { toast } = useToast();
  const { playSuccess, playError } = useAudioFeedback();
  const { settings, fetchAndUpdateToken, settingsLoaded } = useApiSettings();
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

  const updateRecentItems = (newItem: BaseProduct) => {
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

  const fetchProductAndInsights = useCallback(async (sku: string, locationIdOverride?: string | null) => {
    if (!sku || sku.trim().length < 4) {
      toast({ variant: 'destructive', title: 'Invalid SKU', description: 'Please enter a valid SKU or EAN.' });
      return;
    }
    setIsFetchingProduct(true);
    handleReset();

    const locationId = locationIdOverride || settings.locationId;
    if (!locationId) {
        playError();
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter a store location ID in settings.' });
        setIsFetchingProduct(false);
        return;
    }


    // Step 1: Get basic data
    const { data, error } = await getProductData({
      locationId,
      skus: [sku],
      bearerToken: settings.bearerToken,
      debugMode: settings.debugMode,
    });

    if (error || !data || data.length === 0) {
      setIsFetchingProduct(false);
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
      return;
    }

    const foundProduct = data[0];

    // Step 2: Enrich with full details
    let completeProduct = foundProduct;
    try {
      const res = await fetch(`/api/morrisons/product?sku=${foundProduct.sku}`, {
        headers: {
          ...(settings.bearerToken ? { 'Authorization': `Bearer ${settings.bearerToken}` } : {})
        },
        cache: 'no-store',
      });

      if (res.ok) {
        const details: FullProduct = await res.json();
        // Merge the rich details into the product object
        completeProduct = {
          ...foundProduct,
          productDetails: {
            ...foundProduct.productDetails, // Keep any existing details from base fetch
            ...details, // Overwrite with richer details
          }
        };
      }
    } catch (e) {
      console.error("Could not fetch full product details:", e);
      // Continue with just the base product info
    }

    setProduct(completeProduct);
    updateRecentItems(completeProduct);
    setIsFetchingProduct(false);
    playSuccess();
    toast({ title: 'Product Found', description: `Generating insights for ${completeProduct.name}...` });
    form.setValue('sku', '');

    // Step 3: Generate insights with the complete data
    setIsGeneratingInsights(true);
    try {
      const insightResult = await productInsightsFlow({ productData: completeProduct });
      setInsights(insightResult);
    } catch (e) {
      console.error("Insight generation failed:", e);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not generate product insights.' });
    } finally {
      setIsGeneratingInsights(false);
    }
  }, [settings.locationId, settings.bearerToken, settings.debugMode, toast, form, playError, playSuccess, fetchAndUpdateToken, consecutiveFails]);


  // Handle dynamic links from URL params
  useEffect(() => {
    const skuToLoad = skuFromPath || searchParams.get('sku');
    const locationFromUrl = searchParams.get('locationId');
    
    if (skuToLoad && settingsLoaded && (settings.locationId || locationFromUrl)) {
      fetchProductAndInsights(skuToLoad, locationFromUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuFromPath, searchParams, settingsLoaded, settings.locationId]);


  const handleReset = () => {
    setProduct(null);
    setInsights(null);
  }

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
    toast({ title: 'Reading Label', description: 'Reading numbers from the label...' });
    try {
      const result = await ocrFlow({ imageDataUri });
      if (result.eanOrSku) {
        toast({ title: 'Success', description: `Found number: ${result.eanOrSku}` });
        await handleScanSuccess(result.eanOrSku);
      } else {
        playError();
        toast({ variant: 'destructive', title: 'Read Failed', description: 'Could not find a valid SKU or EAN on the label.' });
      }
    } catch (e) {
      console.error("OCR flow failed", e);
      playError();
      toast({ variant: 'destructive', title: 'Read Error', description: 'An error occurred while reading the image.' });
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

  const productDetails = product?.productDetails;
  const bws = productDetails?.beersWinesSpirits;
  const hasBwsDetails = bws && (bws.alcoholByVolume || bws.tastingNotes || bws.volumeInLitres);
  const productLocation = product ? parseLocationString(product.location.standard) : null;

  const startOfDayStock = product?.spaceInfo?.startOfDayQty;
  const currentStock = product?.stockQuantity;
  const todaysSales = (startOfDayStock !== undefined && currentStock !== undefined) ? startOfDayStock - currentStock : null;

  return (
    <div className="min-h-screen">
      <AnimatePresence>
        {isScanMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsScanMode(false)}
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
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
                {isOcrLoading ? 'Reading...' : 'Read Label'}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsScanMode(false)}
                className="absolute top-2 right-2 z-10 rounded-full bg-background/50 hover:bg-background/80"
              >
                <X className="h-5 w-5" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <Card className="max-w-2xl mx-auto mb-8">
          <CardHeader>
            <CardTitle>Product Assistant</CardTitle>
            <CardDescription>Search for a product by name or SKU/EAN, or scan its barcode to get details and insights.</CardDescription>
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
          <ProductSkeleton />
        )}

        {product && !isFetchingProduct && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-2xl mx-auto mb-12"
          >
            <Card>
              <CardHeader>
                <div className='flex items-start gap-4'>
                  <ImageModal src={productDetails?.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'} alt={product.name}>
                    <div className={cn("relative rounded-lg p-2 cursor-pointer group/image", "border theme-glass:border-white/20 theme-glass:bg-white/10 theme-glass:backdrop-blur-xl")}>
                      <Image
                        src={productDetails?.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'}
                        alt={product.name}
                        width={100}
                        height={100}
                        className="rounded-md object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity rounded-md">
                        <Expand className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </ImageModal>
                  <div className='flex-grow'>
                    <CardTitle>{product.name}</CardTitle>
                    <CardDescription>
                      <a href={`https://action.focal.systems/ims/product/${product.sku}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group hover:underline">
                        SKU: {product.sku} | Stock: {product.stockQuantity}
                        <LinkIcon className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </CardDescription>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className={cn("text-lg font-semibold", product.price.promotional && "line-through text-muted-foreground text-base")}>
                        £{product.price.regular?.toFixed(2) || 'N/A'}
                      </span>
                      {product.price.promotional && (
                        <Badge variant="destructive">{product.price.promotional}</Badge>
                      )}
                    </div>
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
                        <AccordionTrigger>More Insights</AccordionTrigger>
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
                            <details className="pt-2 text-xs bg-muted/50 p-2 rounded-md">
                              <summary className="cursor-pointer font-semibold">Debug Info</summary>
                              <pre className="mt-2 text-[10px] leading-tight whitespace-pre-wrap break-all">
                                {JSON.stringify(productDetails, null, 2)}
                              </pre>
                            </details>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <DataRow icon={<Barcode />} label="SKU" value={`${product.sku} (EAN: ${product.primaryEan13 || product.scannedSku}) ${product.stockSkuUsed ? `(Stock SKU: ${product.stockSkuUsed})` : ''}`} />
                              <DataRow icon={<Info />} label="Status" value={product.status} />
                              {todaysSales !== null && <DataRow icon={<ShoppingBasket />} label="Today's Sales" value={todaysSales} />}
                              <DataRow icon={<Footprints />} label="Walk Sequence" value={productDetails?.legacyItemNumbers?.[0]} />
                              <DataRow icon={<Tag />} label="Promo Location" value={product.location.promotional} />
                              <DataRow icon={<Crown />} label="Brand" value={productDetails?.brand} />
                              <DataRow icon={<Globe />} label="Country of Origin" value={productDetails?.countryOfOrigin} />
                              <DataRow icon={<Thermometer />} label="Temperature" value={product.temperature} />
                              <DataRow icon={<Weight />} label="Weight" value={productDetails?.dimensions?.weight ? `${productDetails.dimensions.weight} kg` : null} />
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

                            {productDetails && <Accordion type="single" collapsible className="w-full text-xs">
                              <AccordionItem value="stock">
                                <AccordionTrigger className='py-2 font-semibold'>Stock & Logistics</AccordionTrigger>
                                <AccordionContent className="space-y-3 pt-2">
                                  {product.lastStockChange?.lastCountDateTime && product.lastStockChange?.lastCountDateTime !== 'N/A' ? (
                                    <DataRow
                                      icon={<History />}
                                      label="Last Stock Event"
                                      value={`${product.lastStockChange.inventoryAction} of ${product.lastStockChange.qty} by ${product.lastStockChange.createdBy} at ${product.lastStockChange.lastCountDateTime}`}
                                    />
                                  ) : (<DataRow icon={<History />} label="Last Stock Event" value="No data available" />)}
                                  <DataRow icon={<Layers />} label="Storage" value={productDetails.storage?.join(', ')} />
                                  <DataRow icon={<Layers />} label="Pack Info" value={productDetails.packs?.map(p => `${p.packQuantity}x ${p.packNumber}`).join('; ')} />
                                  <DataRow icon={<CalendarClock />} label="Min Life (CPC/CFC)" value={productDetails.productLife ? `${productDetails.productLife.minimumCPCAcceptanceLife} / ${productDetails.productLife.minimumCFCAcceptanceLife} days` : null} />
                                  <DataRow icon={<Flag />} label="Perishable" value={productDetails.productFlags?.perishableInd ? 'Yes' : 'No'} />
                                  <DataRow icon={<Flag />} label="Manual Order" value={productDetails.manuallyStoreOrderedItem} />
                                  <DataRow icon={<Info />} label="Start of Day Stock" value={product.spaceInfo?.startOfDayQty} />
                                  <DataRow icon={<Info />} label="End of Day Stock" value={product.spaceInfo?.endOfDayQty} />
                                  <DataRow icon={<Info />} label="Facings" value={product.spaceInfo?.standardSpace?.locations?.[0].facings} />
                                  <DataRow icon={<Info />} label="Fill Quantity" value={product.spaceInfo?.standardSpace?.locations?.[0].fillQty} />
                                  <DataRow icon={<Info />} label="Merch Type" value={product.spaceInfo?.standardSpace?.locations?.[0].merchandiseType} />
                                </AccordionContent>
                              </AccordionItem>
                              {productDetails.commercialHierarchy && (
                                <AccordionItem value="classification">
                                  <AccordionTrigger className='py-2 text-xs font-semibold'>Classification</AccordionTrigger>
                                  <AccordionContent className="pt-2">
                                    <p className="text-xs">
                                      {[
                                        productDetails.commercialHierarchy.divisionName,
                                        productDetails.commercialHierarchy.groupName,
                                        productDetails.commercialHierarchy.departmentName,
                                        productDetails.commercialHierarchy.className,
                                        productDetails.commercialHierarchy.subclassName,
                                      ].filter(Boolean).map(s => s?.replace(/^\d+\s/, '')).join(' → ')}
                                    </p>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                              {hasBwsDetails && (
                                <AccordionItem value="bws">
                                  <AccordionTrigger className='py-2 font-semibold'>Beers, Wines & Spirits</AccordionTrigger>
                                  <AccordionContent className="space-y-3 pt-2">
                                    <DataRow icon={<div className='w-5 text-center font-bold'>%</div>} label="ABV" value={bws?.alcoholByVolume ? `${bws.alcoholByVolume}%` : null} />
                                    <DataRow icon={<GlassWater />} label="Tasting Notes" value={bws?.tastingNotes} />
                                    <DataRow icon={<GlassWater />} label="Volume" value={bws?.volumeInLitres ? `${bws.volumeInLitres}L` : null} />
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                            </Accordion>}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <ChatInterface product={product} locationId={settings.locationId} />

                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </main>
    </div>
  );
}

    