
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, Bot, PackageSearch, Lightbulb, MapPin, Boxes, PoundSterling, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { getProductData } from '@/app/actions';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { useApiSettings } from '@/hooks/use-api-settings';
import { cn } from '@/lib/utils';
import { pickingAnalysisFlow } from '@/ai/flows/picking-analysis-flow';
import type { AnalyzedProduct } from '@/ai/flows/picking-analysis-types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ocrPrompt } from '@/ai/flows/picking-analysis-flow';

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

type EnrichedAnalysis = AnalyzedProduct & {
    productData?: FetchMorrisonsDataOutput[0];
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
        
        // Step 2: Fetch detailed product data using the extracted SKUs.
        const { data: productsData, error: productError } = await getProductData({
            locationId: settings.locationId,
            skus,
            bearerToken: settings.bearerToken,
            debugMode: settings.debugMode,
        });

        if (productError) {
             toast({ variant: 'destructive', title: 'Data Fetch Failed', description: productError });
        }

        if (!productsData || productsData.length === 0) {
            toast({ variant: 'destructive', title: 'Analysis Failed', description: 'Could not fetch data for any of the identified SKUs.' });
            setIsLoading(false);
            return;
        }
        
        toast({ title: 'Data Fetched', description: 'AI is now generating suggestions...' });
        
        // Step 3: Call the main analysis prompt with the image AND the fetched data.
        const analysis = await pickingAnalysisFlow({
            imageDataUri: imageDataUri!,
            // The definitive fix: sanitize the data before sending it back to the server action.
            productsData: JSON.parse(JSON.stringify(productsData))
        });

        // This sanitization is also crucial to prevent serialization errors on the client.
        const cleanAnalysis = JSON.parse(JSON.stringify(analysis));

        if (!cleanAnalysis.products || cleanAnalysis.products.length === 0) {
            toast({ variant: 'destructive', title: 'Analysis Failed', description: 'The AI could not provide any suggestions for the identified products.' });
            setIsLoading(false);
            return;
        }

        // Step 4: Enrich the analysis with the fetched data for UI display
        const productDataMap = new Map(productsData.map(p => [p.sku, p]));
        const enrichedResults = cleanAnalysis.products.map((p: AnalyzedProduct) => ({
            ...p,
            // Sanitize the product data again right before setting state
            productData: p.sku ? JSON.parse(JSON.stringify(productDataMap.get(p.sku) || null)) : undefined,
        }));
        
        setAnalysisResults(enrichedResults);
        toast({ title: 'Analysis Complete!', description: `AI has provided suggestions for ${enrichedResults.length} items.` });

    } catch (error) {
         toast({
            variant: 'destructive',
            title: 'Analysis Failed',
            description: `An error occurred during analysis: ${error instanceof Error ? error.message : String(error)}`,
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
              Stuck on a pick? Upload a screenshot of your Amazon picking list. The AI will analyze it and provide suggestions to help you find the items.
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
                    <Card key={item.sku || index}>
                        <CardHeader>
                            {item.productData && !item.productData.proxyError ? (
                                <CardTitle>{item.productData.name}</CardTitle>
                            ) : (
                                <CardTitle>{item.productName || 'Unknown Product'}</CardTitle>
                            )}
                            <CardDescription>SKU: {item.sku || 'Not Found'}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {item.productData && !item.productData.proxyError ? (
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                         <div className="p-4 border rounded-lg">
                                            <div className="flex items-center gap-3 text-sm">
                                                <Boxes className="h-5 w-5 text-primary" />
                                                <span>Stock: <strong>{item.productData.stockQuantity}</strong></span>
                                            </div>
                                            <div className="flex items-start gap-3 text-sm mt-2">
                                                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                                                <div className="flex-grow">
                                                    <span>Location: <strong>{item.productData.location.standard || 'None'}</strong></span>
                                                    {item.productData.location.secondary && (
                                                        <div className="text-xs text-muted-foreground">
                                                            Secondary: {item.productData.location.secondary}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                             <div className="flex items-center gap-3 text-sm mt-2">
                                                <PoundSterling className="h-5 w-5 text-primary" />
                                                <span>Price: <strong>£{item.productData.price.regular?.toFixed(2) || 'N/A'}</strong></span>
                                            </div>
                                         </div>
                                         <div className="p-4 border rounded-lg bg-accent/50">
                                            <h3 className="font-bold flex items-center gap-2 mb-2"><Lightbulb className="h-5 w-5 text-primary" /> AI Judgment</h3>
                                            <p className="text-sm font-semibold text-primary-foreground bg-primary/80 rounded-md p-2">{item.judgement}</p>
                                         </div>
                                    </div>
                                     <div className="p-4 border rounded-lg">
                                        <h3 className="font-bold mb-2">Next Steps</h3>
                                        <ul className="list-disc pl-5 space-y-2 text-sm">
                                            {item.nextSteps?.map((step, i) => (
                                                <li key={i}>{step}</li>
                                            ))}
                                        </ul>
                                     </div>

                                </div>

                            ) : (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Could Not Fetch Details</AlertTitle>
                                    <AlertDescription>
                                        {item.productData?.proxyError ? item.productData.proxyError : `Could not fetch detailed product data for SKU ${item.sku}. The AI's suggestions are based only on the name.`}
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
