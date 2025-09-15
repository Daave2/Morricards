
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, Bot, PackageSearch, Lightbulb, Info, ThumbsUp, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { getProductData } from '@/app/actions';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { useApiSettings } from '@/hooks/use-api-settings';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ocrPrompt } from '@/ai/flows/picking-analysis-flow';
import { productInsightsFlow, type ProductInsightsOutput } from '@/ai/flows/product-insights-flow';

const ImageUpload = ({ onImageSelect, selectedImage, disabled }: { onImageSelect: (file: File) => void, selectedImage: File | null, disabled?: boolean }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageSelect(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <Card className={cn(disabled && 'bg-muted/50')}>
      <CardContent className='p-4'>
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg bg-card transition-colors ${
            isDragging ? 'border-primary' : 'border-border'
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-accent'}`}
        >
          {selectedImage ? (
            <Image
              src={URL.createObjectURL(selectedImage)}
              alt="Selected image"
              fill
              className="object-contain rounded-lg p-2"
            />
          ) : (
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
              <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
              <p className="mb-2 text-sm text-muted-foreground">
                <span className="font-semibold">Click to upload screenshot</span>
                <br/>
                or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">PNG or JPG</p>
            </div>
          )}
          <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept="image/*" disabled={disabled} />
        </label>
      </CardContent>
    </Card>
  );
};

const toDataUri = (file: File | null): Promise<string | null> => {
    if (!file) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

type EnrichedAnalysis = {
    product: FetchMorrisonsDataOutput[0];
    insights: ProductInsightsOutput | null;
    error?: string | null;
};

export default function AmazonClient() {
  const [listImage, setListImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<EnrichedAnalysis[]>([]);
  
  const { toast } = useToast();
  const { settings } = useApiSettings();

  const handleAnalysis = async () => {
    if (!listImage) {
      toast({
        variant: 'destructive',
        title: 'Missing Image',
        description: 'Please upload a screenshot of the picking list.',
      });
      return;
    }

    setIsLoading(true);
    setAnalysisResults([]);
    toast({ title: 'Starting Analysis...', description: 'AI is reading the list. This may take a moment.' });
    
    try {
        const imageDataUri = await toDataUri(listImage);
        
        // Step 1: AI extracts SKUs from the image.
        const ocrResult = await ocrPrompt({ imageDataUri: imageDataUri! });
        const skus = ocrResult.output?.skus || [];

        if (skus.length === 0) {
            toast({ variant: 'destructive', title: 'OCR Failed', description: 'The AI could not read any SKUs from the image.' });
            setIsLoading(false);
            return;
        }

        toast({ title: 'Products Identified', description: `Found ${skus.length} SKUs. Fetching product details...` });
        
        // Step 2: Fetch detailed product data for all SKUs at once.
        const { data: productsData, error: productError } = await getProductData({
            locationId: settings.locationId,
            skus,
            bearerToken: settings.bearerToken,
            debugMode: settings.debugMode,
        });

        if (productError) {
             toast({ variant: 'destructive', title: 'Data Fetch Failed', description: productError });
        }
        
        const productMap = new Map(productsData?.map(p => [p.sku, p]));
        
        toast({ title: 'Data Fetched', description: 'AI is now generating insights for each product...' });
        
        // Step 3: For each SKU, generate insights using the fetched data.
        const insightPromises = skus.map(async (sku) => {
            const product = productMap.get(sku);
            if (!product) {
                return { product: { sku, name: `Product not found for SKU ${sku}` } as any, insights: null, error: `Could not fetch data for SKU ${sku}` };
            }
            try {
                const insights = await productInsightsFlow({ productData: product });
                return { product, insights, error: null };
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                console.error(`Insight generation failed for SKU ${sku}:`, errorMessage);
                return { product, insights: null, error: errorMessage };
            }
        });

        const results = await Promise.all(insightPromises);

        // **CRUCIAL FINAL SANITIZATION**
        // This guarantees that only plain objects are passed to the state.
        try {
            const sanitizedResults = JSON.parse(JSON.stringify(results));
            setAnalysisResults(sanitizedResults);
        } catch (serializationError) {
            toast({
                variant: 'destructive',
                title: 'Fatal Serialization Error',
                description: `Could not make the results safe for React. RAW DATA: ${JSON.stringify(results)}`,
                duration: 20000,
            });
            // Fallback to setting raw results if sanitization fails, which might still crash but we tried.
            setAnalysisResults(results);
        }
        
        const successCount = results.filter(r => r.insights).length;
        toast({ title: 'Analysis Complete!', description: `AI has provided insights for ${successCount} of ${results.length} items.` });

    } catch (error) {
         toast({
            variant: 'destructive',
            title: 'Analysis Failed',
            description: `An error occurred during analysis: ${error instanceof Error ? error.message : String(error)}.`,
            duration: 20000,
        });
        console.error(error);
    }

    setIsLoading(false);
  };

  return (
    <main className="container mx-auto px-4 py-8 md:py-12">
      <div className="space-y-8 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PackageSearch /> Amazon Picker Assistant</CardTitle>
            <CardDescription>
              Stuck on a pick? Upload a screenshot of your Amazon picking list. The AI will analyze it and provide insights to help you find the items.
            </CardDescription>
          </CardHeader>
        </Card>

        <ImageUpload onImageSelect={setListImage} selectedImage={listImage} disabled={isLoading} />

        <Button
          onClick={handleAnalysis}
          disabled={isLoading || !listImage}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bot className="mr-2 h-4 w-4" />
          )}
          Analyze Picking List
        </Button>

        {isLoading && analysisResults.length === 0 && (
            <div className="text-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">AI is analyzing, this may take a moment...</p>
            </div>
        )}

        {analysisResults.length > 0 && (
            <div className='space-y-6'>
                {analysisResults.map((item, index) => (
                    <Card key={item.product.sku || index}>
                        <CardHeader>
                            <CardTitle>{item.product.name || 'Unknown Product'}</CardTitle>
                            <CardDescription>SKU: {item.product.sku || 'Not Found'}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           {item.insights ? (
                             <div className="grid md:grid-cols-2 gap-6">
                                <div className="p-4 border rounded-lg bg-accent/50 space-y-4">
                                    <div>
                                        <h3 className="font-bold flex items-center gap-2 mb-2"><Info className="h-5 w-5 text-primary" /> About This Product</h3>
                                        <p className="text-sm">{item.insights.customerFacingSummary}</p>
                                    </div>
                                </div>
                                <div className="p-4 border rounded-lg space-y-4">
                                    <div>
                                        <h3 className="font-bold flex items-center gap-2 mb-2"><ThumbsUp className="h-5 w-5 text-primary" /> Key Selling Points</h3>
                                        <ul className="list-disc pl-5 space-y-2 text-sm">
                                            {item.insights.sellingPoints?.map((point, i) => (
                                                <li key={i}>{point}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    {item.insights.recipeIdeas && item.insights.recipeIdeas.length > 0 && (
                                        <div>
                                            <h3 className="font-bold flex items-center gap-2 mb-2"><Lightbulb className="h-5 w-5 text-primary" /> Recipe Ideas</h3>
                                            <ul className="list-disc pl-5 space-y-2 text-sm">
                                                {item.insights.recipeIdeas?.map((idea, i) => (
                                                    <li key={i}>{idea}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                           ) : (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Could Not Analyze Product</AlertTitle>
                                    <AlertDescription>
                                        {item.error || `Could not generate AI insights for SKU ${item.product.sku}.`}
                                    </AlertDescription>
                                </Alert>
                           )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}
      </div>
    </main>
  );
}

    