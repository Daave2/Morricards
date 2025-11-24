

'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useAudioFeedback } from '@/hooks/use-audio-feedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, PackageSearch, Search, ScanLine, Link as LinkIcon, ServerCrash, Trash2, Copy, FileUp, AlertTriangle, Mail, ChevronDown, Barcode, Footprints, Tag, Thermometer, Weight, Info, Crown, Globe, Package, CalendarClock, Flag, Building2, Layers, Leaf, Shell, Beaker, History, CameraOff, Zap, X, Undo2, Settings, WifiOff, Wifi, CloudCog, Bolt, Bot, Truck, ScanSearch, CheckCircle2, DownloadCloud, Boxes, MessageSquare, Expand } from 'lucide-react';
import Image from 'next/image';
import type { FetchMorrisonsDataOutput, DeliveryInfo, Order } from '@/lib/morrisons-api';
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
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import ZXingScanner from '@/components/ZXingScanner';
import { ToastAction } from '@/components/ui/toast';
import { useApiSettings, DEFAULT_SETTINGS } from '@/hooks/use-api-settings';
import { useNetworkSync } from '@/hooks/useNetworkSync';
import InstallPrompt from '@/components/InstallPrompt';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import SkuQrCode from '@/components/SkuQrCode';
import { ocrFlow } from '@/ai/flows/ocr-flow';
import type { AvailabilityReason } from '@/lib/idb';
import Link from 'next/link';
import SearchComponent from '@/components/assistant/Search';
import type { SearchHit } from '@/lib/morrisonsSearch';
import { queueProductFetch } from '@/lib/offlineQueue';
import ImageModal from '@/components/image-modal';


type Product = FetchMorrisonsDataOutput[0];
type ReportedItem = Product & { reason: string; comment?: string; reportId: string };

const FormSchema = z.object({
  sku: z.string().optional(),
});

const ReasonSchema = z.object({
    reason: z.string().min(1, { message: "Please select a reason." }),
    comment: z.string().optional(),
}).refine(data => {
    if (data.reason === 'Other' && !data.comment) {
        return false;
    }
    return true;
}, {
    message: "Please provide a comment for 'Other' reason.",
    path: ['comment'],
});


const LOCAL_STORAGE_KEY_AVAILABILITY = 'morricards-availability-report';
const LOCAL_STORAGE_KEY_RECENT_AVAILABILITY = 'morricards-availability-recent';


const DataRow = ({ icon, label, value, valueClassName }: { icon: React.ReactNode, label: string, value?: string | number | null | React.ReactNode, valueClassName?: string }) => {
    if (value === undefined || value === null || value === '') return null;
    return (
        <div className="flex items-start gap-3">
            <div className="w-5 h-5 text-muted-foreground flex-shrink-0 pt-0.5">{icon}</div>
            <div className='flex-grow min-w-0'>
                <span className="font-bold">{label}:</span> <span className={cn('break-all', valueClassName)}>{value}</span>
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
    
    const deliveryInfoContent = deliveryInfo ? (
      <span>
        {deliveryInfo.orderPosition === 'next' ? 'Next delivery' : 'Last delivery'}: <strong>{formatDate(deliveryInfo.expectedDate)} - {deliveryInfo.totalUnits} units</strong>
      </span>
    ) : (
        <span>Next delivery: <strong>None</strong></span>
    );
  
  const hasAllOrders = allOrders && allOrders.length > 0;

  if (hasAllOrders) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="flex items-center gap-3 text-sm cursor-pointer hover:text-foreground/80 p-3 rounded-md -mx-3 transition-colors">
                    <Truck className="h-5 w-5 text-primary" />
                    {deliveryInfoContent}
                </div>
            </DialogTrigger>
            <DeliveryDetailsModal orders={allOrders} productName={productName} />
        </Dialog>
    )
  }

  return (
    <div className="flex items-center gap-3 text-sm p-3 -mx-3">
        <Truck className="h-5 w-5 text-primary" />
        {deliveryInfoContent}
    </div>
  )
}


const StatusIndicator = ({ isFetching }: { isFetching: boolean }) => {
  const { isOnline, lastSync } = useNetworkSync();
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    if (lastSync) {
      const update = () => {
        const seconds = Math.floor((Date.now() - lastSync) / 1000);
        if (seconds < 60) setTimeAgo('just now');
        else if (seconds < 3600) setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
        else setTimeAgo(`${Math.floor(seconds / 3600)}h ago`);
      };
      update();
      const interval = setInterval(update, 60000); // every minute
      return () => clearInterval(interval);
    }
  }, [lastSync]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
            {isOnline ? <Wifi className="h-4 w-4 text-primary" /> : <WifiOff className="h-4 w-4 text-destructive" />}
            {lastSync && !isFetching && (
              <>
                <CloudCog className="h-4 w-4" />
                <span>Synced: {timeAgo}</span>
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isFetching ? 'Fetching data...' : isOnline ? 'You are currently online.' : 'You are currently offline.'}</p>
          {lastSync && <p>Last data sync was {timeAgo}.</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default function AvailabilityPage() {
  const [reportedItems, setReportedItems] = useState<ReportedItem[]>([]);
  const [recentItems, setRecentItems] = useState<ReportedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isScanMode, setIsScanMode] = useState(false);
  const [isSpeedMode, setIsSpeedMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [editingItem, setEditingItem] = useState<ReportedItem | null>(null);
  const [lastDeletedItem, setLastDeletedItem] = useState<{ item: ReportedItem; index: number } | null>(null);
  const [consecutiveFails, setConsecutiveFails] = useState(0);
  
  const { toast, dismiss } = useToast();
  const { playSuccess, playError } = useAudioFeedback();
  const { settings, fetchAndUpdateToken } = useApiSettings();
  const { isOnline } = useNetworkSync();


  const scannerRef = useRef<{ start: () => void; stop: () => void; getOcrDataUri: () => string | null; } | null>(null);

  const startScannerWithDelay = useCallback(() => {
    setTimeout(() => {
        if (isScanMode && scannerRef.current) {
            scannerRef.current.start();
        }
    }, 1500); // 1.5 second delay
  }, [isScanMode]);

  useEffect(() => {
    if (isScanMode) {
      scannerRef.current?.start();
    } else {
      scannerRef.current?.stop();
    }
  }, [isScanMode]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      sku: '',
    },
  });

   const reasonForm = useForm<z.infer<typeof ReasonSchema>>({
    resolver: zodResolver(ReasonSchema),
    defaultValues: { reason: '', comment: '' },
  });
  const watchedReason = reasonForm.watch('reason');
  
  useEffect(() => {
    try {
      const savedItems = localStorage.getItem(LOCAL_STORAGE_KEY_AVAILABILITY);
      if (savedItems) {
        setReportedItems(JSON.parse(savedItems));
      }
      const savedRecentItems = localStorage.getItem(LOCAL_STORAGE_KEY_RECENT_AVAILABILITY);
       if (savedRecentItems) {
        setRecentItems(JSON.parse(savedRecentItems));
      }
    } catch (error) {
      console.error("Failed to load items from local storage", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_AVAILABILITY, JSON.stringify(reportedItems));
    } catch (error) {
      console.error("Failed to save reported items to local storage", error);
    }
  }, [reportedItems]);

  const updateRecentItems = (newItem: ReportedItem) => {
    setRecentItems(prev => {
      const withoutOld = prev.filter(item => item.sku !== newItem.sku);
      const newRecent = [newItem, ...withoutOld].slice(0, 5);
      localStorage.setItem(LOCAL_STORAGE_KEY_RECENT_AVAILABILITY, JSON.stringify(newRecent));
      return newRecent;
    });
  };


  const processSku = useCallback(async (sku: string) => {
    if (!sku || sku.trim().length < 4) {
        toast({ variant: 'destructive', title: 'Invalid SKU', description: 'Please enter a valid SKU or EAN to report.' });
        if (isSpeedMode) startScannerWithDelay();
        return;
    }
    
    if (isSpeedMode) {
        setIsScanMode(true); // Keep scanner active
    } else {
        setIsScanMode(false); // Close scanner on scan
    }
    
    const { locationId } = settings;
    if (!locationId) {
        playError();
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter a store location ID in settings before scanning.' });
        if (isSpeedMode) startScannerWithDelay();
        return;
    }
    
    if (reportedItems.some(item => item.sku === sku || item.scannedSku === sku)) {
        playError();
        const existingItem = reportedItems.find(item => item.sku === sku || item.scannedSku === sku);
        toast({
            variant: 'destructive',
            title: 'Item Already Reported',
            description: `${existingItem?.name} is already on the report list.`
        });
        if (isSpeedMode) startScannerWithDelay();
        return;
    }

    if (!isOnline) {
        playSuccess();
        toast({
            title: "Queued for Sync",
            description: `Item ${sku} was captured while offline and will be processed later when you reconnect.`,
            icon: <WifiOff className="h-5 w-5" />
        });
        await queueProductFetch({ sku, locationId });
        if (isSpeedMode) startScannerWithDelay();
        return;
    }
    
    setIsLoading(true);
    setIsFetching(true);
    form.setValue('sku', '');

    const { data, error } = await getProductData({
      locationId,
      skus: [sku],
      bearerToken: settings.bearerToken,
      debugMode: settings.debugMode,
    });

    setIsLoading(false);
    setIsFetching(false);


    if (error || !data || data.length === 0) {
        const errText = error || `Could not find product data for EAN: ${sku}`;
        playError();
        const newFailCount = consecutiveFails + 1;
        setConsecutiveFails(newFailCount);

        let toastAction: React.ReactElement | undefined = (
            <ToastAction altText="Copy" onClick={() => navigator.clipboard.writeText(errText)}>
                 <Copy className="mr-2 h-4 w-4" /> Copy
            </ToastAction>
        );

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
            description: newFailCount >= 2 ? "Lookup failed again. Your token may have expired." : errText,
            duration: 15000,
            action: toastAction,
        });

        if (isSpeedMode) {
            setIsScanMode(true);
            startScannerWithDelay();
        }
    } else {
        setConsecutiveFails(0); // Reset on success
        const product = data[0];
        let defaultReason: AvailabilityReason = 'Early Sellout';
        if (product.stockQuantity === 0) {
            defaultReason = 'No Stock';
        } else if (product.stockQuantity < 10) {
            defaultReason = 'Low Stock';
        }

        if (isSpeedMode) {
            playSuccess();
            const newReportedItem: ReportedItem = {
                ...product,
                reportId: `${product.sku}-${Date.now()}`,
                reason: defaultReason,
                comment: `Added in Speed Mode`,
            };
            setReportedItems(prev => [newReportedItem, ...prev]);
            updateRecentItems(newReportedItem);

            if (defaultReason === 'Early Sellout' && product.stockQuantity >= 10) {
                 toast({
                    variant: 'default',
                    title: 'Item Reported',
                    description: `${product.name} reported. Note: Stock is ${product.stockQuantity}, but was added as 'Early Sellout'.`,
                    icon: <AlertTriangle className="h-5 w-5 text-amber-500" />
                });
            } else {
                 toast({ title: 'Item Reported', description: `${product.name} added to the report list.` });
            }
            startScannerWithDelay();

        } else if (!product.location.standard && product.stockQuantity <= 0) {
            playError();
            toast({ 
                variant: 'destructive', 
                title: 'Item Not Ranged', 
                description: `${product.name} does not seem to be ranged at this store.`,
                icon: <AlertTriangle className="h-5 w-5" />
            });
            if (isSpeedMode) startScannerWithDelay();
        } else {
          playSuccess();
          setScannedProduct(product);
          setEditingItem(null);
          reasonForm.reset({ reason: defaultReason, comment: '' });
          setIsModalOpen(true);
        }
    }
  }, [form, playError, toast, playSuccess, reasonForm, settings.bearerToken, settings.debugMode, settings.locationId, isOnline, reportedItems, isSpeedMode, startScannerWithDelay, consecutiveFails, fetchAndUpdateToken]);

  const handleScanSuccess = useCallback(async (text: string) => {
    const sku = text.split(',')[0].trim();
    if (sku) {
        await processSku(sku);
    }
  }, [processSku]);

  const handleSearchPick = (hit: SearchHit) => {
    if (hit.retailerProductId) {
      processSku(hit.retailerProductId);
    } else {
      toast({
        variant: 'destructive',
        title: 'Selection Error',
        description: 'The selected product does not have a valid ID to look up.'
      })
    }
  }

  const handleScanError = (message: string) => {
    const lowerMessage = message.toLowerCase();
    if (!lowerMessage.includes('not found') && !lowerMessage.includes('no multiformat readers')) {
      toast({
        variant: 'destructive',
        title: 'Scanner Error',
        description: message,
        action: (
            <ToastAction altText="Copy" onClick={() => navigator.clipboard.writeText(message)}>
                <Copy className="mr-2 h-4 w-4" /> Copy
            </ToastAction>
        ),
      });
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
            toast({ title: 'Read Success', description: `Found number: ${result.eanOrSku}` });
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
  
  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setScannedProduct(null);
      setEditingItem(null);
      if (!editingItem && isSpeedMode) {
          setIsScanMode(true);
          startScannerWithDelay();
      }
    }
  }

  const handleReasonSubmit = (values: z.infer<typeof ReasonSchema>) => {
      let reportedItem: ReportedItem | null = null;
      if (editingItem) {
        // We are editing an existing item
        const updatedItem: ReportedItem = {
            ...editingItem,
            reason: values.reason,
            comment: values.comment,
        };
        reportedItem = updatedItem;
        setReportedItems(prev => prev.map(item => item.reportId === editingItem.reportId ? updatedItem : item));
        toast({ title: 'Item Updated', description: `${editingItem.name} has been updated.` });

      } else if (scannedProduct) {
        // We are adding a new item
         const newReportedItem: ReportedItem = {
            ...scannedProduct,
            reportId: `${scannedProduct.sku}-${Date.now()}`,
            reason: values.reason,
            comment: values.comment,
        };
        reportedItem = newReportedItem;
        setReportedItems(prev => [newReportedItem, ...prev]);
        toast({ title: 'Item Reported', description: `${scannedProduct.name} has been added to the report list.` });
      }
      
      if (reportedItem) {
        updateRecentItems(reportedItem);
      }
      handleModalOpenChange(false);
  }
  
  const handleEditItem = (item: ReportedItem) => {
      setEditingItem(item);
      setScannedProduct(null);
      reasonForm.reset({ reason: item.reason, comment: item.comment || '' });
      setIsModalOpen(true);
  }

  const handleRecentItemClick = (item: ReportedItem) => {
     if (reportedItems.some(i => i.sku === item.sku)) {
        toast({
            variant: 'destructive',
            title: 'Item Already Reported',
            description: `${item.name} is already on the report list.`
        });
        return;
    }
    setReportedItems(prev => [item, ...prev]);
    toast({ title: 'Item Added', description: `${item.name} re-added to the report list.` });
  }

  const handleUndoDelete = useCallback(() => {
    if (lastDeletedItem) {
      const { item, index } = lastDeletedItem;
      setReportedItems(prev => {
        const newItems = [...prev];
        newItems.splice(index, 0, item);
        return newItems;
      });
      setLastDeletedItem(null);
      dismiss();
      toast({
        title: 'Action Undone',
        description: `${item.name} has been restored to the report list.`
      })
    }
  }, [lastDeletedItem, dismiss, toast]);

  const handleDeleteItem = (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation(); // Prevent card's onClick from firing
    
    const itemIndex = reportedItems.findIndex(item => item.reportId === reportId);
    if (itemIndex === -1) return;

    const itemToDelete = reportedItems[itemIndex];
    setLastDeletedItem({ item: itemToDelete, index: itemIndex });

    setReportedItems(prev => prev.filter(item => item.reportId !== reportId));

    toast({
        title: 'Item Removed',
        description: 'The item has been removed from the report list.',
        action: (
          <ToastAction altText="Undo" onClick={handleUndoDelete}>
              <Undo2 className="mr-1 h-4 w-4" />
              Undo
          </ToastAction>
      ),
    });
  }

  const handleScanButtonClick = () => {
    setIsScanMode(prev => !prev);
  }

  const handleClearList = () => {
    setReportedItems([]);
    toast({
        title: 'List Cleared',
        description: 'The report list has been cleared.',
    });
  }

  const handleCopyHtml = async () => {
    function escapeHtml(s: string | number) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    const rows = reportedItems.map(p => ({
        img: p.productDetails.imageUrl?.[0]?.url && p.productDetails.imageUrl?.[0]?.url.trim() !== '' ? p.productDetails.imageUrl?.[0]?.url : 'https://placehold.co/100x100.png',
        sku: p.sku,
        name: p.name,
        stock: p.stockQuantity,
        location: p.location.standard || 'N/A',
        reason: p.reason,
        comment: p.comment === 'Added in Speed Mode' ? '' : p.comment || ''
    }));

    const head = `
      <table border="1" cellspacing="0" cellpadding="8" style="border-collapse:collapse;width:100%;font:12px sans-serif;">
        <thead style="background:#f2f2f2;font-weight:bold;text-align:left;">
          <tr>
            <th>Image</th><th>SKU</th><th>Name</th><th>Stock</th><th>Location</th><th>Reason</th><th>Comment</th>
          </tr>
        </thead>
        <tbody>`;
    const body = rows.map((r, i) => `
      <tr${i % 2 ? "" : ' bgcolor="#f9f9f9"'}>
        <td><img src="${r.img}" width="60" height="60" style="object-fit:cover;border-radius:4px;"></td>
        <td>${escapeHtml(r.sku)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.stock)}</td>
        <td>${escapeHtml(r.location)}</td>
        <td>${escapeHtml(r.reason)}</td>
        <td>${escapeHtml(r.comment)}</td>
      </tr>`).join("");
    const tail = `</tbody></table>`;
    const html = head + body + tail;

    try {
        const tmp = document.createElement("div");
        tmp.style.position = "fixed";
        tmp.style.left = "-9999px";
        tmp.innerHTML = html;
        document.body.appendChild(tmp);
        
        const range = document.createRange();
        range.selectNodeContents(tmp);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        
        const success = document.execCommand("copy");
        
        sel?.removeAllRanges();
        document.body.removeChild(tmp);

        if (success) {
            toast({ title: "Copied for Email", description: "HTML table copied to clipboard." });
        } else {
            throw new Error("Copy command was unsuccessful.");
        }
    } catch (copyError) {
        console.error("HTML copy failed:", copyError);
        toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy data to clipboard.' });
    }
  };

  const handleExportToChat = async () => {
    if (reportedItems.length === 0) {
        toast({
            variant: 'destructive',
            title: 'Report is empty',
            description: 'Please add items to the report before exporting.',
        });
        return;
    }
    
    // Fallback to a hardcoded default if the setting is empty.
    const DEFAULT_WEBHOOK = 'https://chat.googleapis.com/v1/spaces/AAQA0I44GoE/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=ScysZAnKmUOE3ZhkcTVP-9xL8RXYhJPYXW37kwY2wdw';
    const webhookUrl = settings.chatWebhookUrl || DEFAULT_WEBHOOK;


    toast({ title: 'Exporting to Chat...', description: `Sending ${reportedItems.length} items.` });
    
    try {
        const widgets = reportedItems.flatMap(item => {
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(item.sku)}`;
            const imageUrl = item.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/200x200.png';

            let text = `<b>${item.name}</b>`;
            text += `<br><b>SKU:</b> ${item.sku}`;
            text += `<br><b>Stock:</b> ${item.stockQuantity}`;
            text += `<br><b>Reason:</b> ${item.reason}`;
            if (item.comment) {
                text += `<br><b>Comment:</b> <i>${item.comment}</i>`;
            }

            return [
                {
                    "columns": {
                        "columnItems": [
                            {
                                "horizontalSizeStyle": "FILL_MINIMUM_SPACE",
                                "horizontalAlignment": "CENTER",
                                "verticalAlignment": "CENTER",
                                "widgets": [{"image": {"imageUrl": qrCodeUrl}}],
                            },
                            {
                                "horizontalSizeStyle": "FILL_AVAILABLE_SPACE",
                                "widgets": [
                                    {"textParagraph": {"text": text}},
                                    {"image": {"imageUrl": imageUrl}},
                                ],
                            },
                        ]
                    }
                },
                {"divider": {}},
            ];
        });
        
        const payload = {
            "cardsV2": [{
                "cardId": `availability-report-${Date.now()}`,
                "card": {
                    "header": {
                        "title": "Availability Report",
                        "subtitle": `${reportedItems.length} item(s) reported from Store ${settings.locationId}`,
                        "imageUrl": "https://cdn-icons-png.flaticon.com/512/2838/2838885.png",
                        "imageType": "CIRCLE",
                    },
                    "sections": [{ "widgets": widgets }],
                },
            }]
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            toast({
                title: 'Export Successful',
                description: 'The report was sent to Google Chat.',
            });
        } else {
            const errorText = await response.text();
            throw new Error(`Webhook failed with status ${response.status}: ${errorText}`);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to export to chat:', error);
        toast({
            variant: 'destructive',
            title: 'Export Failed',
            description: `Could not send report to Google Chat. ${errorMessage}`,
            duration: 10000,
        });
    }
  };
  
  const productForModal = editingItem || scannedProduct;

  const handleCopyRawData = useCallback(() => {
    if (productForModal) {
      const rawJson = JSON.stringify(productForModal.productDetails, null, 2);
      navigator.clipboard.writeText(rawJson).then(() => {
        toast({ title: 'Raw Data Copied', description: 'The raw JSON data has been copied to your clipboard.' });
      }).catch(err => {
        toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy data to clipboard.'});
      });
    }
  }, [productForModal, toast]);

  return (
    <>
    <div className="min-h-screen">
      <InstallPrompt />
      {isScanMode && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsScanMode(false)}
          />
          <div
            className={cn(
              'fixed bottom-4 inset-x-4 z-50 p-4 space-y-4 max-w-md mx-auto',
              'rounded-2xl border shadow-xl',
              'bg-background',
              'theme-glass:bg-black/30 theme-glass:border-white/20 theme-glass:backdrop-blur-xl'
            )}
          >
            <ZXingScanner
              ref={scannerRef}
              onResult={(text) => handleScanSuccess(text)}
              onError={handleScanError}
            />
            <Button onClick={handleOcrRequest} disabled={isOcrLoading} className="w-full">
              {isOcrLoading ? <Loader2 className="animate-spin" /> : <ScanSearch />}
              {isOcrLoading ? 'Reading...' : 'Read with Assistant'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsScanMode(false)}
              className="absolute top-2 right-2 z-10 rounded-full bg-background/50 hover:bg-background/80"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
      
       <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Report' : 'Report Item'}</DialogTitle>
              <DialogDescription>
                {editingItem ? 'Update the reason for reporting this item.' : 'Select a reason for reporting this item. This will be sent to the supply chain team.'}
              </DialogDescription>
            </DialogHeader>
          <Form {...reasonForm}>
            <form onSubmit={reasonForm.handleSubmit(handleReasonSubmit)} className="space-y-4">
                <div className="space-y-4 pr-2 -mr-2 max-h-[calc(80vh-200px)] overflow-y-auto">
                    {productForModal && (
                      <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 rounded-lg bg-card theme-glass:bg-white/10 theme-glass:backdrop-blur-lg">
                             <ImageModal src={(productForModal.productDetails.imageUrl?.[0]?.url && productForModal.productDetails.imageUrl?.[0]?.url.trim() !== '') ? productForModal.productDetails.imageUrl[0].url : `https://placehold.co/100x100.png`} alt={productForModal.name}>
                                <div className={cn(
                                    "relative w-20 h-20 flex-shrink-0 cursor-pointer group/image rounded-lg overflow-hidden p-2",
                                    "border theme-glass:border-white/20 theme-glass:bg-white/20 theme-glass:backdrop-blur-lg"
                                )}>
                                    <Image
                                      src={(productForModal.productDetails.imageUrl?.[0]?.url && productForModal.productDetails.imageUrl?.[0]?.url.trim() !== '') ? productForModal.productDetails.imageUrl[0].url : `https://placehold.co/100x100.png`}
                                      alt={productForModal.name}
                                      fill
                                      className="rounded-md object-cover"
                                      data-ai-hint="product image"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity rounded-md">
                                        <Expand className="h-6 w-6 text-white" />
                                    </div>
                                </div>
                            </ImageModal>
                            <div className="text-sm space-y-1 flex-grow min-w-0">
                              <p className="font-bold break-words">{productForModal.name}</p>
                               {productForModal.price.promotional && (
                                  <div className="pt-1">
                                    <Badge variant="destructive" className="bg-accent text-accent-foreground">{productForModal.price.promotional}</Badge>
                                  </div>
                                )}
                                <a href={`https://action.focal.systems/ims/product/${productForModal.sku}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group hover:underline">
                                    <p className="text-lg">Stock: <span className="font-extrabold text-3xl text-primary">{productForModal.stockQuantity}</span></p>
                                    <LinkIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                              <div>Location: <span className="font-semibold">{productForModal.location.standard || 'N/A'}</span></div>
                              {productForModal.location.secondary && <div>Secondary: <span className="font-semibold">{productForModal.location.secondary}</span></div>}
                               <DeliveryInfoRow deliveryInfo={productForModal.deliveryInfo} allOrders={productForModal.allOrders} productName={productForModal.name} />
                            </div>
                        </div>
                        <div className="px-1 space-y-3 text-xs text-muted-foreground">
                            <DataRow icon={<Barcode />} label="SKU" value={`${productForModal.sku} (EAN: ${productForModal.scannedSku}) ${productForModal.stockSkuUsed ? `(Stock SKU: ${productForModal.stockSkuUsed})` : ''}`} />
                            <DataRow icon={<Footprints />} label="Walk Sequence" value={productForModal.productDetails.legacyItemNumbers?.[0]} />
                            <DataRow icon={<Tag />} label="Promo Location" value={productForModal.location.promotional} />

                            <div className="flex justify-center py-2">
                              <SkuQrCode sku={productForModal.sku} />
                            </div>

                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="stock">
                                 <AccordionTrigger className='py-2 text-xs font-semibold'>Stock & Logistics</AccordionTrigger>
                                 <AccordionContent className="space-y-3 pt-2">
                                    {productForModal.lastStockChange?.lastCountDateTime && (
                                        <DataRow
                                            icon={<History />}
                                            label="Last Stock Event"
                                            value={`${productForModal.lastStockChange.inventoryAction} of ${productForModal.lastStockChange.qty} by ${productForModal.lastStockChange.createdBy} at ${productForModal.lastStockChange.lastCountDateTime}`}
                                        />
                                      )}
                                     <DataRow icon={<Layers />} label="Storage" value={productForModal.productDetails.storage?.join(', ')} />
                                     <DataRow icon={<Layers />} label="Pack Info" value={productForModal.productDetails.packs?.map(p => `${p.packQuantity}x ${p.packNumber}`).join('; ')} />
                                     <DataRow icon={<CalendarClock />} label="Min Life (CPC/CFC)" value={productForModal.productDetails.productLife ? `${productForModal.productDetails.productLife.minimumCPCAcceptanceLife} / ${productForModal.productDetails.productLife.minimumCFCAcceptanceLife} days` : null} />
                                     <DataRow icon={<Flag />} label="Perishable" value={productForModal.productDetails.productFlags?.perishableInd ? 'Yes' : 'No'} />
                                     <DataRow icon={<Flag />} label="Manual Order" value={productForModal.productDetails.manuallyStoreOrderedItem} />
                                 </AccordionContent>
                              </AccordionItem>
                              {productForModal.productDetails.commercialHierarchy && (
                                 <AccordionItem value="classification">
                                    <AccordionTrigger className='py-2 text-xs font-semibold'>Classification</AccordionTrigger>
                                    <AccordionContent className="pt-2">
                                       <p className="text-xs">
                                            {productForModal.productDetails.commercialHierarchy.divisionName} &rarr; {productForModal.productDetails.commercialHierarchy.groupName} &rarr; {productForModal.productDetails.commercialHierarchy.className} &rarr; {productForModal.productDetails.commercialHierarchy.subclassName}
                                        </p>
                                    </AccordionContent>
                                 </AccordionItem>
                              )}
                            </Accordion>
                             <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full mt-2"
                                onClick={handleCopyRawData}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Raw Data
                              </Button>
                        </div>
                      </div>
                  )}
                  
                  <div className="space-y-4 pt-4">
                    <FormField
                      control={reasonForm.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reason</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a reason..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="No Stock">No Stock</SelectItem>
                              <SelectItem value="Low Stock">Low Stock</SelectItem>
                              <SelectItem value="Early Sellout">Early Sellout</SelectItem>
                              <SelectItem value="Too Much Stock">Too Much Stock</SelectItem>
                              <SelectItem value="Amazon INF">Amazon INF</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchedReason === 'Other' && (
                        <FormField
                          control={reasonForm.control}
                          name="comment"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Comment</FormLabel>
                                  <FormControl>
                                      <Textarea placeholder="Please provide more details..." {...field} />
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                        />
                    )}
                  </div>
                </div>

              <DialogFooter>
                <Button type="submit">{editingItem ? 'Update Report' : 'Add to Report'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <main className="container mx-auto px-4 py-8 md:py-12">
        <TooltipProvider>
        <div className={cn(isScanMode && "hidden")}>
          {!isOnline && (
            <Alert variant="destructive" className="mb-6 max-w-4xl mx-auto text-left">
                <WifiOff className="h-4 w-4" />
                <AlertTitle>You are offline</AlertTitle>
                <AlertDescription>
                    Scanned items will be queued and processed when you reconnect. Some functionality may be limited.
                </AlertDescription>
            </Alert>
          )}
          
           <Card className="max-w-4xl mx-auto mb-8">
            <CardContent className="p-4 space-y-4">
              <Form {...form}>
                <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                    <div className="space-y-4">
                        <SearchComponent onPick={handleSearchPick} />
                        <Button
                        type="button"
                        className="w-full"
                        onClick={() => setIsScanMode(true)}
                        disabled={isLoading}
                        variant="outline"
                        >
                        <ScanLine className="mr-2 h-4 w-4" />
                        Or Scan Product Barcode
                        </Button>
                    </div>

                </form>
              </Form>
              <div className="flex items-center space-x-2 justify-center pt-2">
                <Switch id="speed-mode" checked={isSpeedMode} onCheckedChange={setIsSpeedMode} />
                <Label htmlFor="speed-mode" className="flex items-center gap-2">
                    <Bolt className={cn("h-4 w-4 transition-colors", isSpeedMode ? "text-primary" : "text-muted-foreground")} />
                    Speed Mode
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading && reportedItems.length === 0 && (
           <div className="text-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Looking up product...</p>
          </div>
        )}

          {reportedItems.length > 0 ? (
              <Card>
                  <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <CardTitle>Reported Items ({reportedItems.length})</CardTitle>
                      <div className="flex flex-wrap items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" onClick={handleExportToChat}>
                                  <MessageSquare className="mr-2 h-4 w-4" />
                                  Export to Chat
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Send a formatted report to a Google Chat webhook.</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" onClick={handleCopyHtml}>
                                  <Mail className="mr-2 h-4 w-4" />
                                  Copy for Email
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy the list as a rich HTML table, ready to paste into an email.</p>
                            </TooltipContent>
                          </Tooltip>
                          <AlertDialog>
                           <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Clear all items from the report list.</p>
                              </TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action will clear the entire report list. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearList}>Clear List</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                      </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {reportedItems.map((item) => (
                        <div key={item.reportId} onClick={() => handleEditItem(item)} className="relative flex items-start gap-4 p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                          <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 z-10" onClick={(e) => handleDeleteItem(e, item.reportId)}>
                            <X className="h-4 w-4" />
                          </Button>
                            <ImageModal src={(item.productDetails.imageUrl?.[0]?.url && item.productDetails.imageUrl?.[0]?.url.trim() !== '') ? item.productDetails.imageUrl[0].url : `https://placehold.co/100x100.png`} alt={item.name}>
                                <div className={cn(
                                    "relative w-16 h-16 flex-shrink-0 cursor-pointer group/image rounded-lg overflow-hidden p-2",
                                    "border theme-glass:border-white/20 theme-glass:bg-white/10 theme-glass:backdrop-blur-lg"
                                )}>
                                   <Image
                                      src={(item.productDetails.imageUrl?.[0]?.url && item.productDetails.imageUrl?.[0]?.url.trim() !== '') ? item.productDetails.imageUrl[0].url : `https://placehold.co/100x100.png`}
                                      alt={item.name}
                                      fill
                                      className="rounded-md object-cover"
                                      data-ai-hint="product image small"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity rounded-md">
                                        <Expand className="h-6 w-6 text-white" />
                                    </div>
                                </div>
                            </ImageModal>
                          <div className="flex-grow">
                             <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-semibold">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                                </div>
                                <Badge variant={item.reason === 'Other' || item.reason === 'Amazon INF' ? 'secondary' : 'default'} className="mr-8">{item.reason}</Badge>
                             </div>
                             <div className="text-sm mt-2">
                               <p><strong>Stock:</strong> {item.stockQuantity}</p>
                               {item.comment && <p className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded-md"><strong>Comment:</strong> {item.comment}</p>}
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
              </Card>
          ) : recentItems.length > 0 && !isLoading ? (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl font-semibold mb-4">Recently Reported</h2>
              <div className="space-y-4">
                {recentItems.map((item, i) => (
                  <Card
                    key={item.reportId}
                    className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-shadow animate-in fade-in-50"
                    style={{ animationDelay: `${i * 100}ms` }}
                    onClick={() => handleRecentItemClick(item)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={cn("rounded-lg p-2", "border theme-glass:border-white/20 theme-glass:bg-white/10 theme-glass:backdrop-blur-xl")}>
                          <Image
                            src={(item.productDetails.imageUrl?.[0]?.url && item.productDetails.imageUrl?.[0]?.url.trim() !== '') ? item.productDetails.imageUrl[0].url : `https://placehold.co/100x100.png`}
                            alt={item.name}
                            width={80}
                            height={80}
                            className="rounded-md object-cover"
                            data-ai-hint="product image small"
                          />
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                        <div className="mt-2 flex items-baseline gap-2">
                            <Badge variant={item.reason === 'Other' ? 'secondary' : 'default'}>{item.reason}</Badge>
                            <p className="text-xs text-muted-foreground">Stock: {item.stockQuantity}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
           ) : !isLoading && (
              <Card>
                <CardContent className="p-12 text-center">
                    <Bot className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Search or scan a product to add it to the availability report.</p>
                </CardContent>
            </Card>
           )}
        </TooltipProvider>
      </main>
    </div>
    </>
  );
}
