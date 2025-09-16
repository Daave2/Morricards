
'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import Image from 'next/image';
import { useApiSettings } from '@/hooks/use-api-settings';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { amazonAnalysisFlow, EnrichedAnalysis } from '@/ai/flows/amazon-analysis-flow';
import type { DeliveryInfo, Order } from '@/lib/morrisons-api';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import StoreMap, { type ProductLocation } from '@/components/StoreMap';
import SkuQrCode from '@/components/SkuQrCode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';


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
}: {
  onImageSelect: (file: File) => void;
  selectedImage: File | null;
  disabled?: boolean;
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
      <CardContent className="p-4">
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg bg-card transition-colors ${
            isDragging ? 'border-primary' : 'border-border'
          } ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-accent'
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

const AmazonResultCard = ({ item, index }: { item: EnrichedAnalysis, index: number }) => {
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [isQrOpen, setIsQrOpen] = useState(false);
    const productLocation = item.product ? parseLocationString(item.product.location.standard) : null;
  
    return (
      <Card key={item.product?.sku || index}>
        <CardHeader>
           <div className='flex items-start gap-4'>
                <div className={cn("rounded-lg p-2 flex-shrink-0", "border theme-glass:border-white/20 theme-glass:bg-white/10 theme-glass:backdrop-blur-xl")}>
                    <Image
                        src={item.product?._raw?.productProxy?.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'}
                        alt={item.product?.name || 'Unknown'}
                        width={100}
                        height={100}
                        className="rounded-md object-cover"
                    />
                </div>
                <div className='flex-grow'>
                    <CardTitle>{item.product?.name || 'Unknown Product'}</CardTitle>
                    <CardDescription>
                        SKU: {item.product?.sku || 'Not Found'}
                    </CardDescription>
                     {item.product && <div className="mt-2 flex items-baseline gap-2">
                         <span className={cn("text-lg font-semibold", item.product.price.promotional && "line-through text-muted-foreground text-base")}>
                            £{item.product.price.regular?.toFixed(2) || 'N/A'}
                        </span>
                        {item.product.price.promotional && (
                            <Badge variant="destructive">{item.product.price.promotional}</Badge>
                        )}
                    </div>}
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {item.product && !item.error ? (
            <div className="space-y-4">
                {item.diagnosticSummary && (
                     <Alert>
                        <Bot className="h-4 w-4" />
                        <AlertTitle>AI Diagnosis</AlertTitle>
                        <AlertDescription>
                            {item.diagnosticSummary}
                        </AlertDescription>
                    </Alert>
                )}
                <div className="space-y-4 text-sm pt-4">
                  <DataRow
                    icon={<Boxes />}
                    label="Stock"
                    value={`${item.product.stockQuantity} ${item.product.stockUnit || ''}`}
                  />
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
                      <Collapsible open={isMapOpen} onOpenChange={setIsMapOpen}>
                        <CollapsibleTrigger asChild>
                            <Button variant="outline" className="w-full">
                                <Map className="mr-2 h-4 w-4" />
                                {isMapOpen ? 'Hide Map' : 'Show on Map'}
                                <ChevronDown className={cn("h-4 w-4 ml-2 transition-transform", isMapOpen && "rotate-180")} />
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="w-full border rounded-lg bg-card/80 backdrop-blur-sm shadow-lg overflow-x-auto mt-4">
                              <StoreMap productLocations={[{ sku: item.product.sku, location: productLocation }]} />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
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
                    ) : ( <DataRow icon={<History />} label="Last Stock Event" value="No data available" />)}
                    
                    <Collapsible open={isQrOpen} onOpenChange={setIsQrOpen}>
                        <CollapsibleTrigger asChild>
                            <Button variant="outline" className="w-full">
                                <Barcode className="mr-2 h-4 w-4" />
                                {isQrOpen ? 'Hide SKU Barcode' : 'Show SKU Barcode'}
                                <ChevronDown className={cn("h-4 w-4 ml-2 transition-transform", isQrOpen && "rotate-180")} />
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="flex justify-center py-4">
                                <SkuQrCode sku={item.product.sku} />
                            </div>
                        </CollapsibleContent>
                    </Collapsible>

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
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Could Not Analyze Product</AlertTitle>
              <AlertDescription>
                {item.error ||
                  `Could not fetch data for SKU ${item.product?.sku}.`}
              </AlertDescription>
               <details className="pt-2 text-xs">
                  <summary className="cursor-pointer font-semibold">Raw Data</summary>
                  <pre className="mt-2 bg-muted p-2 rounded-md overflow-auto max-h-48 text-[10px] leading-tight whitespace-pre-wrap break-all">
                      {JSON.stringify(item, null, 2)}
                  </pre>
              </details>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
}

export default function AmazonClient() {
  const [listImage, setListImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<EnrichedAnalysis[]>([]);

  const { toast } = useToast();
  const { settings } = useApiSettings();

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
    toast({
      title: 'Starting Analysis...',
      description: 'AI is reading the list. This may take a moment.',
    });

    try {
      const imageDataUri = await toDataUri(listImage);
      if (!imageDataUri) {
        throw new Error('Could not convert image to data URI.');
      }
      
      const results = await amazonAnalysisFlow({
          imageDataUri: imageDataUri!,
          locationId: settings.locationId,
          bearerToken: settings.bearerToken,
          debugMode: settings.debugMode,
      });

      // **CRUCIAL FINAL SANITIZATION**
      try {
        const sanitizedResults = JSON.parse(JSON.stringify(results));
        setAnalysisResults(sanitizedResults);
      } catch (serializationError) {
        toast({
          variant: 'destructive',
          title: 'Fatal Client-Side Serialization Error',
          description: `Could not make the results safe for React. Check console for raw data.`,
          duration: 20000,
        });
        console.error("RAW DATA causing serialization error on client:", results);
      }
      
      const successCount = results.filter((r) => r.product && !r.error).length;
      toast({
        title: 'Analysis Complete!',
        description: `Successfully analyzed ${successCount} of ${results.length} items.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Analysis Failed',
        description: `An error occurred during analysis: ${
          error instanceof Error ? error.message : String(error)
        }.`,
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
            <CardTitle className="flex items-center gap-2">
              <PackageSearch /> Amazon Picker Assistant
            </CardTitle>
            <CardDescription>
              Stuck on a pick? Upload a screenshot of your Amazon picking list.
              The AI will analyze it and provide insights to help you find the
              items.
            </CardDescription>
          </CardHeader>
        </Card>

        <ImageUpload
          onImageSelect={setListImage}
          selectedImage={listImage}
          disabled={isLoading}
        />

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
            <p className="text-muted-foreground">
              AI is analyzing, this may take a moment...
            </p>
          </div>
        )}

        {analysisResults.length > 0 && (
          <div className="space-y-6">
            {analysisResults.map((item, index) => (
              <AmazonResultCard item={item} index={index} key={item.product?.sku || index} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

    

    

    

    