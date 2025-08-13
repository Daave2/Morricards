
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAudioFeedback } from '@/hooks/use-audio-feedback';
import ZXingScanner from '@/components/ZXingScanner';
import { Loader2, ScanLine, X, AlertTriangle, CheckCircle2, Bot, Camera, Copy, Trash2 } from 'lucide-react';
import { useApiSettings } from '@/hooks/use-api-settings';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { validatePriceTicket } from '@/ai/flows/price-validator-flow';
import type { PriceTicketValidationOutput } from '@/ai/flows/price-validator-types';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const FormSchema = z.object({
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
});

type ValidationResult = PriceTicketValidationOutput & {
  id: string;
  imageDataUri: string;
  timestamp: string;
};

const LOCAL_STORAGE_KEY_VALIDATION = 'morricards-price-validation-log';

const normalize = (p: string | null | undefined) => p?.replace(/[£\s]/g, '').toLowerCase();

const PriceTicketMockup = ({ title, name, price, sku, isMismatch = {} }: { title: string, name?: string | null, price?: string | null, sku?: string | null, isMismatch?: Record<string, boolean> }) => (
    <div className="border-2 border-dashed rounded-lg p-3 space-y-2 flex-1 min-w-[200px] bg-background/60">
        <p className="text-xs font-bold text-muted-foreground text-center">{title}</p>
        <Separator className="border-dashed" />
        <div className={cn("p-1 rounded", isMismatch.name && "bg-destructive/20 ring-2 ring-destructive")}>
            <p className="font-bold text-center text-sm break-words">{name || 'N/A'}</p>
        </div>
        <div className={cn("p-2 rounded bg-yellow-300/50 text-center", isMismatch.price && "bg-destructive/20 ring-2 ring-destructive")}>
            <p className="text-2xl font-extrabold text-black">{price || 'N/A'}</p>
        </div>
        <div className={cn("p-1 rounded text-center", isMismatch.sku && "bg-destructive/20 ring-2 ring-destructive")}>
            <p className="font-mono text-xs">{sku || 'N/A'}</p>
        </div>
    </div>
);


const PriceTicketDisplay = ({ result }: { result: ValidationResult }) => {
    const { ocrData, product } = result;
    const systemPrice = product?.price.promotional || (product?.price.regular ? `£${product.price.regular.toFixed(2)}` : null);
    
    const nameMismatch = normalize(ocrData?.productName) !== normalize(product?.name);
    const priceMismatch = normalize(ocrData?.price) !== normalize(systemPrice);
    const skuMismatch = ocrData?.eanOrSku !== product?.sku;

    if (result.isCorrect) {
        return (
            <div className="p-2 bg-background/50 rounded-md grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">TICKET DATA (OCR)</p>
                  <p><strong>Price:</strong> {result.ocrData?.price || 'N/A'}</p>
                  <p><strong>SKU/EAN:</strong> {result.ocrData?.eanOrSku || 'N/A'}</p>
                </div>
                 <div>
                  <p className="text-xs font-semibold text-muted-foreground">SYSTEM DATA (API)</p>
                   <p><strong>Price:</strong> {systemPrice || 'N/A'}</p>
                   <p><strong>Promo:</strong> {result.product?.price.promotional || 'None'}</p>
                  <p><strong>SKU:</strong> {result.product?.sku || 'N/A'}</p>
                </div>
              </div>
        )
    }

    return (
        <div className="mt-4 space-y-4">
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Validation Failed</AlertTitle>
                <AlertDescription>
                    {result.mismatchReason || 'An unknown validation error occurred.'}
                </AlertDescription>
             </Alert>
             <div className="flex flex-col sm:flex-row gap-4 justify-center">
                 <PriceTicketMockup
                    title="As Seen on Ticket"
                    name={ocrData?.productName}
                    price={ocrData?.price}
                    sku={ocrData?.eanOrSku}
                    isMismatch={{ name: nameMismatch, price: priceMismatch, sku: skuMismatch }}
                 />
                 <PriceTicketMockup
                    title="As Per System"
                    name={product?.name}
                    price={systemPrice}
                    sku={product?.sku}
                 />
             </div>
        </div>
    )
}

export default function PriceCheckerPage() {
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationLog, setValidationLog] = useState<ValidationResult[]>([]);

  const { toast } = useToast();
  const { playSuccess, playError } = useAudioFeedback();
  const { settings } = useApiSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    try {
      const savedLog = localStorage.getItem(LOCAL_STORAGE_KEY_VALIDATION);
      if (savedLog) {
        setValidationLog(JSON.parse(savedLog));
      }
    } catch (error) {
      console.error("Failed to load validation log from local storage", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_VALIDATION, JSON.stringify(validationLog));
  }, [validationLog]);

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
        setIsCameraMode(false);
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
    if (isCameraMode) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraMode]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { locationId: '218' },
  });

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUri = canvas.toDataURL('image/jpeg', 0.9);

    setIsCameraMode(false);
    toast({ title: 'Processing Ticket', description: 'AI is analyzing the price ticket...' });

    try {
      const result = await validatePriceTicket({
        imageDataUri,
        locationId: form.getValues('locationId'),
        bearerToken: settings.bearerToken,
        debugMode: settings.debugMode,
      });
      
      const newResult: ValidationResult = {
        ...result,
        id: crypto.randomUUID(),
        imageDataUri: imageDataUri,
        timestamp: new Date().toISOString(),
      };
      
      setValidationLog(prev => [newResult, ...prev]);

      if (result.isCorrect) {
        playSuccess();
        toast({
          title: 'Price is Correct!',
          description: `${result.product?.name || 'Product'} price matches the system.`,
          icon: <CheckCircle2 className="text-primary" />
        });
      } else {
        playError();
        toast({
          variant: 'destructive',
          title: 'Price Mismatch!',
          description: result.mismatchReason || 'The price on the ticket does not match the system.',
        });
      }

    } catch (e) {
      console.error("Validation flow failed", e);
      playError();
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      toast({ variant: 'destructive', title: 'AI Error', description: `Could not validate the price ticket. ${errorMessage}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearLog = () => {
    setValidationLog([]);
    toast({
        title: 'Log Cleared',
        description: 'The price validation log has been cleared.',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {isCameraMode && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <video ref={videoRef} autoPlay playsInline className="w-full max-w-4xl h-auto rounded-lg border aspect-video object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-11/12 max-w-2xl h-1/3 border-4 border-dashed border-white/50 rounded-xl" />
            </div>
            <div className="mt-6 flex gap-4">
                <Button size="lg" onClick={handleCapture} className="h-16 w-16 rounded-full">
                    <Camera className="h-8 w-8" />
                </Button>
            </div>
             <Button variant="ghost" size="icon" onClick={() => setIsCameraMode(false)} className="absolute top-4 right-4 z-10 bg-black/20 hover:bg-black/50 text-white hover:text-white">
              <X className="h-6 w-6" />
            </Button>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-primary">AI Price Checker</h1>
          <p className="mt-2 text-lg text-muted-foreground max-w-2xl mx-auto">
            Capture price tickets to automatically validate them against system data.
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
                  onClick={() => setIsCameraMode(true)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" />
                  )}
                  Check a Price Ticket
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {isProcessing && (
          <div className="text-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">AI is analyzing the ticket...</p>
          </div>
        )}

        {validationLog.length > 0 && (
          <Card className="max-w-4xl mx-auto shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Validation Log</CardTitle>
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear Log
                    </Button>
                  </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will clear the entire validation log. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearLog}>Clear Log</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardHeader>
            <CardContent className="space-y-4">
              {validationLog.map(result => (
                <Card key={result.id} className={result.isCorrect ? 'bg-green-50/50' : 'bg-red-50/50 border-destructive'}>
                  <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-start">
                    <Image src={result.imageDataUri} alt="Price ticket" width={150} height={100} className="rounded-md border-2 object-cover flex-shrink-0" />
                    <div className="flex-grow space-y-3 w-full">
                      <div className="flex justify-between items-start gap-2">
                         <h3 className="font-bold text-lg flex-grow min-w-0 break-words">{result.product?.name || result.ocrData?.productName || 'Unknown Product'}</h3>
                         <Badge variant={result.isCorrect ? 'default' : 'destructive'} className="flex-shrink-0">
                           {result.isCorrect ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                           {result.isCorrect ? 'Correct' : 'Mismatch'}
                         </Badge>
                      </div>
                      
                      <PriceTicketDisplay result={result} />

                      <p className="text-xs text-muted-foreground pt-2">
                        Checked on {new Date(result.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}

        {!isProcessing && validationLog.length === 0 && (
            <Card className="max-w-2xl mx-auto shadow-lg border-dashed">
                <CardContent className="p-12 text-center">
                    <Bot className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Use the camera to start validating price tickets.</p>
                </CardContent>
            </Card>
        )}
      </main>
    </div>
  );
}
