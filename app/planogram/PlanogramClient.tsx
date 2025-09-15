
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, Bot, Check, X, ArrowRightLeft, AlertTriangle, Camera, List, PoundSterling } from 'lucide-react';
import Image from 'next/image';
import { planogramFlow } from '@/ai/flows/planogram-flow';
import type { PlanogramOutput, ComparisonResult } from '@/ai/flows/planogram-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import SkuQrCode from '@/components/SkuQrCode';
import { Dialog, DialogContent, DialogHeader, DialogDescription, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { getProductData } from '@/app/actions';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { useApiSettings } from '@/hooks/use-api-settings';


const ImageUpload = ({ title, onImageSelect, onCameraClick, selectedImage, disabled }: { title:string, onImageSelect: (file: File) => void, onCameraClick: () => void, selectedImage: File | null, disabled?: boolean }) => {
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
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg  bg-card transition-colors ${
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
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
              <p className="mb-2 text-sm text-muted-foreground">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">PNG, JPG or WEBP</p>
            </div>
          )}
          <input id={`dropzone-file-${title}`} type="file" className="hidden" onChange={handleFileChange} accept="image/*" disabled={disabled} />
        </label>
        <Button variant="outline" className="w-full" onClick={onCameraClick} disabled={disabled}>
            <Camera className="mr-2 h-4 w-4" />
            Use Camera
        </Button>
      </CardContent>
    </Card>
  );
};

// Helper function to convert a file to a Base64 Data URI
const toDataUri = (file: File | null): Promise<string | null> => {
    if (!file) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

type FullProductInfo = FetchMorrisonsDataOutput[0];

const ProductDetailModal = ({ product, open, onOpenChange }: { product: FullProductInfo | null; open: boolean; onOpenChange: (open: boolean) => void }) => {
    if (!product) return null;

    const imageUrl = product.productDetails?.imageUrl?.[0]?.url || 'https://placehold.co/400x400.png';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{product.name}</DialogTitle>
                    <DialogDescription>SKU: {product.sku}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="flex justify-center">
                        <Image src={imageUrl} alt={product.name} width={150} height={150} className="rounded-lg border object-cover" />
                    </div>
                    <div className="flex justify-center">
                         <SkuQrCode sku={product.sku} size={150} />
                    </div>
                    <Card>
                        <CardContent className="p-4 space-y-2 text-sm">
                             <div className="flex items-center gap-3">
                                <PoundSterling className="h-5 w-5 text-primary" />
                                <span>Price: <strong>£{product.price.regular?.toFixed(2) || 'N/A'}</strong></span>
                            </div>
                            {product.price.promotional && (
                                <div className="pl-8">
                                    <Badge variant="destructive">{product.price.promotional}</Badge>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const ResultsDisplay = ({ results, onShowDetails }: { results: PlanogramOutput; onShowDetails: (item: ComparisonResult) => void }) => {
    const { comparisonResults } = results;

    const correctItems = comparisonResults.filter(r => r.status === 'Correct');
    const misplacedItems = comparisonResults.filter(r => r.status === 'Misplaced');
    const missingItems = comparisonResults.filter(r => r.status === 'Missing');
    const extraItems = comparisonResults.filter(r => r.status === 'Extra');
    const listedItems = comparisonResults.filter(r => r.status === 'Listed');

    const renderResultList = (items: ComparisonResult[], title: string, variant: 'correct' | 'missing' | 'extra' | 'listed' | 'misplaced') => {
        if (items.length === 0) return null;
        
        let icon;
        let badgeVariant: "default" | "destructive" | "secondary" | "outline" = "secondary";
        
        switch(variant) {
            case 'correct': icon = <Check className="h-5 w-5 text-green-500" />; badgeVariant = "default"; break;
            case 'misplaced': icon = <ArrowRightLeft className="h-5 w-5 text-yellow-500" />; badgeVariant = "secondary"; break;
            case 'missing': icon = <X className="h-5 w-5 text-red-500" />; badgeVariant = "destructive"; break;
            case 'extra': icon = <AlertTriangle className="h-5 w-5 text-orange-500" />; badgeVariant = "outline"; break;
            case 'listed': icon = <List className="h-5 w-5 text-primary" />; badgeVariant = "secondary"; break;
        }

        return (
            <div>
                 <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                    {icon} {title} <Badge variant={badgeVariant}>{items.length}</Badge>
                </h3>
                <div className="space-y-3">
                    {items.map((item, index) => (
                        <Card key={index} className="flex flex-col sm:flex-row items-start gap-4 p-3 cursor-pointer hover:bg-accent/50" onClick={() => onShowDetails(item)}>
                            <div className="flex-grow">
                                <p className="font-semibold text-sm">{item.productName}</p>
                                <p className="text-xs text-muted-foreground">SKU: {item.sku || 'N/A'}</p>
                                {variant === 'misplaced' ? (
                                    <div className="text-xs mt-2">
                                        <p>Expected: <span className="font-medium">Shelf {item.expectedShelf}, Pos {item.expectedPosition}</span></p>
                                        <p>Actual: <span className="font-medium text-destructive">Shelf {item.actualShelf}, Pos {item.actualPosition}</span></p>
                                    </div>
                                ) : (item.actualShelf || item.expectedShelf) ? (
                                    <div className="text-xs mt-2">
                                        Location: <span className="font-medium">Shelf {item.actualShelf ?? item.expectedShelf}, Pos {item.actualPosition ?? item.expectedPosition}</span>
                                    </div>
                                ) : null}
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }
    
    const isComparison = missingItems.length > 0 || extraItems.length > 0 || correctItems.length > 0 || misplacedItems.length > 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
                <CardDescription>
                    {isComparison ? "Comparison of the planogram against the physical shelf. Click any item for details." : "Items extracted from the planogram. Click any item for details."}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {renderResultList(listedItems, "Items on Planogram", "listed")}
                {renderResultList(correctItems, "Correctly Placed", "correct")}
                {renderResultList(misplacedItems, "Misplaced Items", "misplaced")}
                {renderResultList(missingItems, "Missing from Shelf", "missing")}
                {renderResultList(extraItems, "Extra on Shelf (Not on Plan)", "extra")}
            </CardContent>
        </Card>
    )
}

export default function PlanogramClient() {
  const [planogramImage, setPlanogramImage] = useState<File | null>(null);
  const [shelfImage, setShelfImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<PlanogramOutput | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'planogram' | 'shelf' | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<FullProductInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { toast } = useToast();
  const { settings } = useApiSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  

  const startCamera = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      } catch (err) {
        console.error("Error accessing camera: ", err);
        toast({
          variant: 'destructive',
          title: 'Camera Error',
          description: 'Could not access the camera. Please check permissions.',
        });
        setIsCameraOpen(false);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    streamRef.current = null;
  };
  
  useEffect(() => {
    if (isCameraOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraOpen]);
  
  const handleOpenCamera = (target: 'planogram' | 'shelf') => {
    setCameraTarget(target);
    setIsCameraOpen(true);
  }

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraTarget) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(blob => {
        if (blob) {
            const file = new File([blob], `${cameraTarget}-capture.jpg`, { type: 'image/jpeg' });
            if (cameraTarget === 'planogram') {
                setPlanogramImage(file);
            } else {
                setShelfImage(file);
            }
            toast({ title: 'Image Captured' });
        }
    }, 'image/jpeg', 0.9);

    setIsCameraOpen(false);
  };

  const handleValidation = async () => {
    if (!planogramImage) {
      toast({
        variant: 'destructive',
        title: 'Missing Planogram',
        description: 'Please upload a planogram image to begin analysis.',
      });
      return;
    }

    setIsLoading(true);
    setResults(null);
    toast({ title: 'Starting Analysis...', description: 'The AI is analyzing the images.' });
    
    try {
        const planogramImageDataUri = await toDataUri(planogramImage);
        const shelfImageDataUri = await toDataUri(shelfImage);

        const flowResult = await planogramFlow({ planogramImageDataUri: planogramImageDataUri!, shelfImageDataUri });
        setResults(flowResult);

        toast({
            title: 'Analysis Complete',
            description: 'The results are displayed below.',
        });

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
  
  const handleShowDetails = async (item: ComparisonResult) => {
    const sku = item.sku || item.ean;
    if (!sku) {
        toast({ variant: 'destructive', title: 'No SKU/EAN', description: 'This item does not have an identifier to look up.' });
        return;
    }
    
    toast({ title: 'Fetching Product Details...' });
    const { data, error } = await getProductData({
        locationId: settings.locationId,
        skus: [sku],
        bearerToken: settings.bearerToken,
        debugMode: settings.debugMode,
    });

    if (error || !data || data.length === 0) {
        toast({ variant: 'destructive', title: 'Product Not Found', description: `Could not fetch details for ${sku}.` });
    } else {
        setSelectedProduct(data[0]);
        setIsModalOpen(true);
    }
  }

  const buttonText = shelfImage ? 'Find Differences' : 'Analyze Planogram';

  return (
    <>
    {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <video ref={videoRef} autoPlay playsInline className="w-full max-w-4xl h-auto rounded-lg border aspect-video object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-11/12 max-w-2xl h-1/2 border-4 border-dashed border-white/50 rounded-xl" />
            </div>
            <div className="mt-6 flex gap-4">
                <Button size="lg" onClick={handleCapture} className="h-16 w-16 rounded-full">
                    <Camera className="h-8 w-8" />
                </Button>
            </div>
             <Button variant="ghost" size="icon" onClick={() => setIsCameraOpen(false)} className="absolute top-4 right-4 z-10 bg-black/20 hover:bg-black/50 text-white hover:text-white">
              <X className="h-6 w-6" />
            </Button>
        </div>
    )}

    <ProductDetailModal product={selectedProduct} open={isModalOpen} onOpenChange={setIsModalOpen} />

    <main className="container mx-auto px-4 py-8 md:py-12">
      <div className="space-y-8 max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>AI Planogram Validator</CardTitle>
            <CardDescription>
              Upload an image of the planogram. Optionally, add a photo of the shelf to find differences. You can also share an image from your phone directly to this page.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ImageUpload title="1. Upload Planogram" onImageSelect={setPlanogramImage} onCameraClick={() => handleOpenCamera('planogram')} selectedImage={planogramImage} disabled={isLoading} />
          <ImageUpload title="2. Upload Shelf Photo (Optional)" onImageSelect={setShelfImage} onCameraClick={() => handleOpenCamera('shelf')} selectedImage={shelfImage} disabled={isLoading} />
        </div>

        <Button
          onClick={handleValidation}
          disabled={isLoading || !planogramImage}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bot className="mr-2 h-4 w-4" />
          )}
          {buttonText}
        </Button>

        {isLoading && (
            <div className="text-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">AI is analyzing, this may take a moment...</p>
            </div>
        )}

        {results && <ResultsDisplay results={results} onShowDetails={handleShowDetails} />}
      </div>
    </main>
    </>
  );
}
