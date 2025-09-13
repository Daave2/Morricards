
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, Bot, Check, X, ArrowRightLeft, AlertTriangle, Camera, List } from 'lucide-react';
import Image from 'next/image';
import { planogramFlow } from '@/ai/flows/planogram-flow';
import type { PlanogramOutput, ComparisonResult } from '@/ai/flows/planogram-types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import SkuQrCode from '@/components/SkuQrCode';


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


const ResultsDisplay = ({ results }: { results: PlanogramOutput }) => {
    const { comparisonResults } = results;

    const correctItems = comparisonResults.filter(r => r.status === 'Correct');
    const misplacedItems = comparisonResults.filter(r => r.status === 'Misplaced');
    const missingItems = comparisonResults.filter(r => r.status === 'Missing');
    const extraItems = comparisonResults.filter(r => r.status === 'Extra');
    const listedItems = comparisonResults.filter(r => r.status === 'Listed');

    const renderTable = (items: ComparisonResult[], title: string, variant: 'correct' | 'missing' | 'extra' | 'listed') => {
        if (items.length === 0) return null;
        
        let icon;
        let badgeVariant: "default" | "destructive" | "secondary" | "outline" = "secondary";
        
        switch(variant) {
            case 'correct': icon = <Check className="h-5 w-5 text-green-500" />; badgeVariant = "default"; break;
            case 'missing': icon = <X className="h-5 w-5 text-red-500" />; badgeVariant = "destructive"; break;
            case 'extra': icon = <AlertTriangle className="h-5 w-5 text-orange-500" />; badgeVariant = "outline"; break;
            case 'listed': icon = <List className="h-5 w-5 text-primary" />; badgeVariant = "secondary"; break;
        }

        const showQr = variant !== 'correct';

        return (
            <div>
                 <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                    {icon} {title} <Badge variant={badgeVariant}>{items.length}</Badge>
                </h3>
                <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs">Product</TableHead>
                                {showQr && <TableHead className="text-xs">QR</TableHead>}
                                <TableHead className="text-center text-xs">Shelf</TableHead>
                                <TableHead className="text-center text-xs">Position</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium min-w-[200px] text-xs">{item.productName} ({item.sku || 'N/A'})</TableCell>
                                    {showQr && (
                                        <TableCell>
                                            {item.sku && <SkuQrCode sku={item.sku} size={128} />}
                                        </TableCell>
                                    )}
                                    <TableCell className="text-center text-xs">{item.actualShelf ?? item.expectedShelf ?? 'N/A'}</TableCell>
                                    <TableCell className="text-center text-xs">{item.actualPosition ?? item.expectedPosition ?? 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    }
    
    const renderMisplacedTable = (items: ComparisonResult[], title: string) => {
        if (items.length === 0) return null;

        return (
             <div>
                 <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                    <ArrowRightLeft className="h-5 w-5 text-yellow-500" /> {title} <Badge variant="secondary">{items.length}</Badge>
                </h3>
                <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs">Product</TableHead>
                                <TableHead className="text-xs">QR</TableHead>
                                <TableHead className="text-xs">Expected</TableHead>
                                <TableHead className="text-xs">Actual</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium min-w-[200px] text-xs">{item.productName} ({item.sku || 'N/A'})</TableCell>
                                    <TableCell>
                                        {item.sku && <SkuQrCode sku={item.sku} size={128} />}
                                    </TableCell>
                                    <TableCell className="text-xs">S:{item.expectedShelf}, P:{item.expectedPosition}</TableCell>
                                    <TableCell className="text-xs">S:{item.actualShelf}, P:{item.actualPosition}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        )
    }

    const isComparison = missingItems.length > 0 || extraItems.length > 0 || correctItems.length > 0 || misplacedItems.length > 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
                <CardDescription>
                    {isComparison ? "Comparison of the planogram against the physical shelf." : "Items extracted from the planogram."}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {renderTable(listedItems, "Items on Planogram", "listed")}
                {renderTable(correctItems, "Correctly Placed", "correct")}
                {renderMisplacedTable(misplacedItems, "Misplaced Items")}
                {renderTable(missingItems, "Missing from Shelf", "missing")}
                {renderTable(extraItems, "Extra on Shelf (Not on Plan)", "extra")}
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
  
  const { toast } = useToast();
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
    <main className="container mx-auto px-4 py-8 md:py-12">
      <div className="space-y-8 max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>AI Planogram Validator</CardTitle>
            <CardDescription>
              Upload an image of the planogram. Optionally, add a photo of the shelf to find differences.
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

        {results && <ResultsDisplay results={results} />}
      </div>
    </main>
    </>
  );
}
