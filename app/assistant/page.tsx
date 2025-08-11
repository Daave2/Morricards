
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
import { Bot, ChevronLeft, Loader2, MapPin, ScanLine, Sparkles, User, X, ShoppingCart, ChefHat } from 'lucide-react';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { useApiSettings } from '@/hooks/use-api-settings';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { productInsightsFlow, ProductInsightsOutput } from '@/ai/flows/product-insights-flow';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ocrFlow } from '@/ai/flows/ocr-flow';
import { Badge } from '@/components/ui/badge';

type Product = FetchMorrisonsDataOutput[0];

const FormSchema = z.object({
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
});

const InsightSection = ({ title, content, icon }: { title: string; content: React.ReactNode, icon?: React.ReactNode; }) => {
  if (!content) return null;
  
  const contentArray = Array.isArray(content) ? content : [content];
  if (contentArray.length === 0) return null;

  return (
    <div>
      <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
        {icon || <Sparkles className="h-5 w-5 text-primary" />}
        {title}
      </h3>
      <div className="text-sm prose prose-sm max-w-none">
          {Array.isArray(content) ? (
            <ul className="list-disc pl-5 space-y-1">
                {content.map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ul>
        ) : (
            <p>{content}</p>
        )}
      </div>
    </div>
  );
};

export default function AssistantPage() {
  const [isScanMode, setIsScanMode] = useState(false);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
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

  const handleScanSuccess = async (sku: string) => {
    setIsScanMode(false);
    setIsFetchingProduct(true);
    setProduct(null);
    setInsights(null);

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
          <div className="flex justify-center items-center gap-4">
            <Bot className="w-12 h-12 text-primary" />
            <h1 className="text-5xl font-bold tracking-tight text-primary">AI Product Assistant</h1>
          </div>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Scan any product to get instant, intelligent insights and selling points.
          </p>
           <Button variant="link" asChild className="mt-2">
                <Link href="/">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Picking List
                </Link>
            </Button>
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
          <Card className="max-w-2xl mx-auto shadow-lg">
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
                            <InsightSection title="About this product" content={<p>{insights.customerFacingSummary}</p>} />
                            {insights.customerFriendlyLocation && (
                                <InsightSection
                                  title="Where to find it"
                                  icon={<MapPin className="h-5 w-5 text-primary" />}
                                  content={<p>{insights.customerFriendlyLocation}</p>}
                                />
                            )}
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
