
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  UploadCloud,
  Bot,
  PackageSearch,
  AlertTriangle,
  MapPin,
  Boxes,
  Truck,
  History,
  Map,
  ChevronDown,
  Barcode,
  CalendarClock,
  CheckCircle2,
  Package,
  Camera,
  X,
  Link as LinkIcon,
  MoreVertical,
  ArrowLeft,
  RefreshCcw,
  ListChecks,
  Expand,
} from 'lucide-react';
import Image from 'next/image';
import { useApiSettings } from '@/hooks/use-api-settings';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { amazonAnalysisFlow, EnrichedAnalysis } from '@/ai/flows/amazon-analysis-flow';
import type { DeliveryInfo, Order, FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import StoreMap, { type ProductLocation } from '@/components/StoreMap';
import SkuQrCode from '@/components/SkuQrCode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ImageModal from '@/components/image-modal';
import TOTPGenerator from '@/components/TOTPGenerator';
import { getProductData } from '@/app/actions';
import { pickerDiagnosisPrompt } from '@/ai/flows/picking-analysis-flow';

const LOCAL_STORAGE_KEY_AVAILABILITY = 'morricards-availability-report';
type ReportedItem = FetchMorrisonsDataOutput[0] & { reason: string; comment?: string; reportId: string };

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

const ImageUpload = ({
  onImageSelect,
  selectedImage,
  disabled,
  onCameraClick,
}: {
  onImageSelect: (file: File) => void;
  selectedImage: File | null;
  disabled?: boolean;
  onCameraClick: () => void;
}) => {
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
      <CardContent className="p-4 space-y-4">
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg bg-card transition-colors ${isDragging ? 'border-primary' : 'border-border'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-accent'
            }`}
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
                <br />
                or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">PNG or JPG</p>
            </div>
          )}
          <input
            id="dropzone-file"
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*"
            disabled={disabled}
          />
        </label>
        <Button variant="outline" className="w-full" onClick={onCameraClick} disabled={disabled}>
          <Camera className="mr-2 h-4 w-4" />
          Use Camera
        </Button>
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

const DataRow = ({ icon, label, value, valueClassName }: { icon: React.ReactNode, label: string, value?: string | number | null | React.ReactNode, valueClassName?: string }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 text-primary flex-shrink-0 pt-0.5">{icon}</div>
      <div className='flex-grow min-w-0'>
        <span className="font-semibold">{label}:</span> <span className={cn('break-words', valueClassName)}>{value}</span>
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
          <div className="flex items-start gap-3 text-sm cursor-pointer hover:bg-muted p-2 -m-2 rounded-md transition-colors">
            <Truck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-grow">{deliveryInfoContent}</div>
          </div>
        </DialogTrigger>
        <DeliveryDetailsModal orders={allOrders} productName={productName} />
      </Dialog>
    )
  }

  return (
    <div className="flex items-start gap-3 text-sm">
      <Truck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex-grow">{deliveryInfoContent}</div>
    </div>
  )
}

const AmazonListItem = React.forwardRef<HTMLDivElement, { item: EnrichedAnalysis; isOpen: boolean; onToggle: () => void; }>(({ item, isOpen, onToggle }, ref) => {
  const { toast } = useToast();
  const productLocation = item.product ? parseLocationString(item.product.location.standard) : null;
  const stockColor = item.product ? (item.product.stockQuantity > 20 ? 'text-green-500' : item.product.stockQuantity > 0 ? 'text-yellow-500' : 'text-red-500') : 'text-gray-500';
  const imageUrl = item.product?._raw?.productProxy?.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png';

  const handleReportMissing = () => {
    if (!item.product) return;

    try {
      const savedItemsRaw = localStorage.getItem(LOCAL_STORAGE_KEY_AVAILABILITY);
      const savedItems: ReportedItem[] = savedItemsRaw ? JSON.parse(savedItemsRaw) : [];

      const isAlreadyReported = savedItems.some(i => i.sku === item.product!.sku);
      if (isAlreadyReported) {
        toast({
          variant: 'destructive',
          title: 'Already Reported',
          description: `${item.product.name} is already on the availability report.`
        });
        return;
      }

      const newReportedItem: ReportedItem = {
        ...(item.product as FetchMorrisonsDataOutput[0]),
        reportId: `${item.product.sku}-${Date.now()}`,
        reason: 'Amazon INF',
        comment: `Reported from Amazon Assistant`,
      };

      const newReportList = [newReportedItem, ...savedItems];
      localStorage.setItem(LOCAL_STORAGE_KEY_AVAILABILITY, JSON.stringify(newReportList));

      toast({
        title: 'Item Reported',
        description: `${item.product.name} has been added to the availability report.`,
      });
    } catch (error) {
      console.error("Failed to update availability report:", error);
      const dataToLog = { ...item.product }; // Create a plain object for logging
      console.error("Data that failed to save:", dataToLog);
      toast({
        variant: 'destructive',
        title: 'Error Saving Item',
        description: 'Could not add the item to the report. Check the console for details.'
      });
    }
  };


  if (!item.product) {
    return (
      <div className="flex items-center p-4 border-b">
        <div className="w-16 h-16 bg-muted rounded-md flex-shrink-0"></div>
        <div className="ml-4 flex-grow">
          <p className="font-semibold text-destructive">Unknown Product</p>
          <p className="text-sm text-destructive">{item.error || 'Could not fetch data.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref}>
      <Collapsible open={isOpen} onOpenChange={onToggle} className={cn("border-b transition-colors", isOpen && 'bg-accent')}>
        <CollapsibleTrigger className="w-full text-left p-4">
          <div className="flex items-center gap-4">
            <ImageModal src={imageUrl} alt={item.product.name}>
              <div className="relative w-16 h-16 flex-shrink-0 cursor-pointer group/image">
                <Image
                  src={imageUrl}
                  alt={item.product.name}
                  width={64}
                  height={64}
                  className="rounded-md object-cover border"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity rounded-md">
                  <Expand className="h-6 w-6 text-white" />
                </div>
              </div>
            </ImageModal>

            <div className="flex-grow min-w-0">
              <p className="font-semibold truncate text-sm">{item.product.name}</p>
              <p className="text-xs text-muted-foreground">SKU: {item.product.sku}</p>
              <p className="text-xs text-muted-foreground">Unit price: £{item.product.price.regular?.toFixed(2) || 'N/A'}</p>
              <p className="text-xs text-muted-foreground">{item.product.temperature}</p>
            </div>
            <div className="ml-4 text-2xl font-bold">
              1
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4">
            <Separator />
            <div className="space-y-4 pt-4">
              {item.diagnosticSummary && (
                <Alert>
                  <Bot className="h-4 w-4" />
                  <AlertTitle>Insight</AlertTitle>
                  <AlertDescription>
                    {item.diagnosticSummary}
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-4 text-sm pt-4">
                <a href={`https://action.focal.systems/ims/product/${item.product.sku}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 group hover:underline">
                  <div className="w-5 h-5 text-primary flex-shrink-0 pt-0.5"><Boxes /></div>
                  <div className='flex-grow min-w-0 flex items-center gap-2'>
                    <span className="font-semibold">Stock:</span>
                    <span className={cn('break-words font-bold', stockColor)}>{`${item.product.stockQuantity} ${item.product.stockUnit || ''}`}</span>
                    <LinkIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
                <DataRow
                  icon={<MapPin />}
                  label="Location"
                  value={item.product.location.standard || 'N/A'}
                />
                {item.product.location.promotional && (
                  <DataRow
                    icon={<MapPin />}
                    label="Promo Location"
                    value={item.product.location.promotional}
                  />
                )}
                {productLocation && (
                  <div className="w-full border rounded-lg bg-card/80 backdrop-blur-sm shadow-lg overflow-x-auto mt-4">
                    <StoreMap productLocations={[{ sku: item.product.sku, location: productLocation }]} />
                  </div>
                )}
                <DeliveryInfoRow
                  deliveryInfo={item.product.deliveryInfo}
                  allOrders={item.product.allOrders}
                  productName={item.product.name}
                />
                {item.product.lastStockChange?.lastCountDateTime && item.product.lastStockChange?.lastCountDateTime !== 'N/A' ? (
                  <DataRow
                    icon={<History />}
                    label="Last Stock Event"
                    value={`${item.product.lastStockChange.inventoryAction} of ${item.product.lastStockChange.qty} by ${item.product.lastStockChange.createdBy} at ${item.product.lastStockChange.lastCountDateTime}`}
                  />
                ) : (<DataRow icon={<History />} label="Last Stock Event" value="No data available" />)}

                <Button variant="outline" className="w-full" onClick={handleReportMissing}>
                  <ListChecks className="mr-2 h-4 w-4" />
                  Report as Missing (INF)
                </Button>

                <div className="flex justify-center py-4">
                  <SkuQrCode sku={item.product.sku} />
                </div>

                <details className="pt-2 text-xs">
                  <summary className="cursor-pointer font-semibold">Raw Data</summary>
                  {item.product.proxyError && (
                    <div className="my-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-xs">
                      <strong>Proxy Error:</strong> {item.product.proxyError}
                    </div>
                  )}
                  <pre className="mt-2 bg-muted p-2 rounded-md overflow-auto max-h-48 text-[10px] leading-tight whitespace-pre-wrap break-all">
                    {JSON.stringify(item.product, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});
AmazonListItem.displayName = 'AmazonListItem';


export default function AmazonClient({ initialSkus, locationIdFromUrl }: { initialSkus?: string[], locationIdFromUrl?: string }) {
  const [listImage, setListImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<EnrichedAnalysis[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const { toast } = useToast();
  const { settings, setSettings } = useApiSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement | null> | null>(null);

  const getMap = () => {
    if (!itemRefs.current) {
      itemRefs.current = new window.Map();
    }
    return itemRefs.current;
  };


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
  
  const runImageAnalysis = useCallback(async (imageDataUri: string) => {
    setIsLoading(true);
    setAnalysisResults([]);
    toast({ title: 'Starting Analysis...', description: 'Reading the list from the image...' });

    try {
      const results = await amazonAnalysisFlow({
        imageDataUri,
        locationId: settings.locationId,
        bearerToken: settings.bearerToken,
        debugMode: settings.debugMode,
      });

      setAnalysisResults(JSON.parse(JSON.stringify(results)));

      const successCount = results.filter((r) => r.product && !r.error).length;
      if (results.length > 0) {
        toast({
          title: 'Analysis Complete!',
          description: `Successfully analyzed ${successCount} of ${results.length} items.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Analysis Failed',
          description: `Could not find any valid products to analyze from the image.`,
        });
      }
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
  }, [toast, settings]);
  
  // This effect handles analysis when the page is loaded via a URL with SKUs
  useEffect(() => {
    if (locationIdFromUrl) {
      setSettings({ locationId: locationIdFromUrl });
    }
    
    if (initialSkus && initialSkus.length > 0) {
      const locationToUse = locationIdFromUrl || settings.locationId;
      
      const analyzeSkusFromUrl = async () => {
        setIsLoading(true);
        setAnalysisResults([]);
        toast({ title: 'Starting Analysis...', description: `Analyzing ${initialSkus.length} product(s) from URL...` });

        const { data: productData, error } = await getProductData({
            skus: initialSkus,
            locationId: locationToUse,
            bearerToken: settings.bearerToken,
            debugMode: settings.debugMode,
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Data Fetch Failed', description: error });
            setIsLoading(false);
            return;
        }

        if (!productData) {
            toast({ variant: 'destructive', title: 'No Products Found', description: 'No products were found for the provided SKUs.' });
            setIsLoading(false);
            return;
        }
        
        toast({ title: 'Products Found', description: `Now generating insights for ${productData.length} items...`});
        
        const productMap = new Map(productData.map(p => [p.sku, p]));
        
        const enrichedResults = await Promise.all(initialSkus.map(async (sku) => {
            const product = productMap.get(sku);
            if (!product) {
                return { product: null, error: `Could not fetch data for SKU ${sku}.`, diagnosticSummary: null };
            }

            try {
                if (!product._raw) {
                    throw new Error("Product has no raw data for AI diagnosis.");
                }
                const sanitizedRawData = JSON.parse(JSON.stringify(product._raw));
                const diagnosticResult = await pickerDiagnosisPrompt({ rawData: sanitizedRawData });
                
                return {
                    product,
                    error: product.proxyError || null,
                    diagnosticSummary: diagnosticResult.output?.diagnosticSummary || 'AI diagnosis failed.',
                };
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                return { product, error: `Failed to generate AI diagnosis: ${errorMsg}`, diagnosticSummary: null };
            }
        }));

        setAnalysisResults(JSON.parse(JSON.stringify(enrichedResults)));
        setIsLoading(false);
        toast({ title: 'Analysis Complete!', description: `Finished analyzing ${enrichedResults.length} items.` });
      }

      analyzeSkusFromUrl();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSkus, locationIdFromUrl]);


  useEffect(() => {
    if (isCameraOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraOpen]);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], `list-capture.jpg`, { type: 'image/jpeg' });
        setListImage(file);
        toast({ title: 'Image Captured' });
      }
    }, 'image/jpeg', 0.9);

    setIsCameraOpen(false);
  };
  
  // This effect handles analysis when an image is selected or shared
  useEffect(() => {
    const handleImageChange = async () => {
      if (!listImage) return;
      const imageDataUri = await toDataUri(listImage);
      if (imageDataUri) {
         runImageAnalysis(imageDataUri);
      }
    }
    handleImageChange();
  }, [listImage, runImageAnalysis]);


  useEffect(() => {
    const handleSharedImage = async () => {
      // @ts-ignore
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener('message', event => {
          if (event.data.action === 'load-image' && event.data.file) {
            setListImage(event.data.file);
            toast({
              title: "Image Received",
              description: "The shared image has been loaded for analysis."
            });
            // Clean up the history so the user can use the back button.
            window.history.replaceState({}, '', '/amazon');
          }
        });
        // Let the service worker know we're ready.
        navigator.serviceWorker.controller.postMessage('share-ready');
      }
    };
    handleSharedImage();
  }, [toast]);


  const handleReset = () => {
    setAnalysisResults([]);
    setListImage(null);
    setOpenItemId(null);
    // Use history.pushState to clear the URL without reloading the page
    window.history.pushState({}, '', '/amazon');
  }

  const handleItemToggle = (id: string) => {
    const newOpenId = openItemId === id ? null : id;
    setOpenItemId(newOpenId);

    if (newOpenId) {
      // Use a short timeout to allow the collapsible content to start opening
      setTimeout(() => {
        const map = getMap();
        const element = map.get(id);
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

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

      <main className="container mx-auto px-0">
        {analysisResults.length > 0 || isLoading ? (
          <div className="max-w-4xl mx-auto bg-card">
            <header className="flex items-center justify-between p-4 h-16 bg-[#00A2E8] text-white sticky top-0 z-10">
              <Button variant="ghost" size="icon" className="text-white" onClick={handleReset}>
                <ArrowLeft />
              </Button>
              <h1 className="text-xl font-semibold">Identified Items</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white">
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleReset}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    <span>Start New Analysis</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </header>
            {isLoading ? (
              <div className="text-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Analyzing, this may take a moment...
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {analysisResults.map((item, index) => {
                  const id = item.product?.sku || String(index);
                  return (
                    <AmazonListItem
                      ref={(el) => { getMap().set(id, el) }}
                      item={item}
                      key={id}
                      isOpen={openItemId === id}
                      onToggle={() => handleItemToggle(id)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8 max-w-4xl mx-auto px-4 py-8">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <PackageSearch /> Amazon Picker Assistant
                    </CardTitle>
                    <CardDescription>
                      Stuck on a pick? Upload a screenshot of your Amazon picking list
                      for analysis.
                    </CardDescription>
                  </div>
                  <div className="w-24 flex-shrink-0">
                    <TOTPGenerator />
                  </div>
                </div>
              </CardHeader>
            </Card>

            <ImageUpload
              onImageSelect={setListImage}
              selectedImage={listImage}
              disabled={isLoading}
              onCameraClick={() => setIsCameraOpen(true)}
            />
          </div>
        )}
      </main>
    </>
  );
}
