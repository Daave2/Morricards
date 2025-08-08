
'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useAudioFeedback } from '@/hooks/use-audio-feedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, PackageSearch, Search, ScanLine, Link as LinkIcon, ServerCrash, Trash2, Copy, FileUp, AlertTriangle, Mail, ChevronDown, Barcode, Footprints, Tag, Thermometer, Weight, Info, Crown, Globe, Package, CalendarClock, Flag, Building2, Layers, Leaf, Shell, Beaker, History, CameraOff, Zap, X, Undo2, Settings, WifiOff } from 'lucide-react';
import Image from 'next/image';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import Link from 'next/link';
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
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import ZXingScanner from '@/components/ZXingScanner';
import { ToastAction } from '@/components/ui/toast';
import { useApiSettings } from '@/hooks/use-api-settings';
import { useNetworkSync } from '@/hooks/useNetworkSync';
import { queueCapture } from '@/lib/offlineQueue';
import InstallPrompt from '@/components/InstallPrompt';

type Product = FetchMorrisonsDataOutput[0];
type ReportedItem = Product & { reason: string; comment?: string; reportId: string };

const FormSchema = z.object({
  locationId: z.string().min(1, { message: 'Store location ID is required.' }),
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

const DataRow = ({ icon, label, value, valueClassName }: { icon: React.ReactNode, label: string, value?: string | number | null | React.ReactNode, valueClassName?: string }) => {
    if (value === undefined || value === null || value === '') return null;
    return (
        <div className="flex items-start gap-3">
            <div className="w-5 h-5 text-muted-foreground flex-shrink-0 pt-0.5">{icon}</div>
            <div className='flex-grow'>
                <span className="font-bold">{label}:</span> <span className={cn(valueClassName)}>{value}</span>
            </div>
        </div>
    );
}

export default function AvailabilityPage() {
  const [reportedItems, setReportedItems] = useState<ReportedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanMode, setIsScanMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoreInfoOpen, setIsMoreInfoOpen] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [editingItem, setEditingItem] = useState<ReportedItem | null>(null);
  const [lastDeletedItem, setLastDeletedItem] = useState<{ item: ReportedItem; index: number } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  
  const { toast, dismiss } = useToast();
  const { playSuccess, playError } = useAudioFeedback();
  const { settings } = useApiSettings();
  const { lastSync } = useNetworkSync();


  const scannerRef = useRef<{ start: () => void } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'onLine' in navigator) {
      setIsOnline(navigator.onLine);
      const onlineHandler = () => setIsOnline(true);
      const offlineHandler = () => setIsOnline(false);
      window.addEventListener('online', onlineHandler);
      window.addEventListener('offline', offlineHandler);
      return () => {
        window.removeEventListener('online', onlineHandler);
        window.removeEventListener('offline', offlineHandler);
      };
    }
  }, []);

  useEffect(() => {
    if (isScanMode) {
      scannerRef.current?.start();
    }
  }, [isScanMode]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      locationId: '218',
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
    } catch (error) {
      console.error("Failed to load reported items from local storage", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_AVAILABILITY, JSON.stringify(reportedItems));
    } catch (error) {
      console.error("Failed to save reported items to local storage", error);
    }
  }, [reportedItems]);

  const handleScanSuccess = useCallback(async (text: string) => {
    const sku = text.split(',')[0].trim();
    if (!sku) return;
    
    setIsScanMode(false); // Close scanner on scan
    
    const locationId = form.getValues('locationId');
    if (!locationId) {
        playError();
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter a store location ID before scanning.' });
        return;
    }
    
    if (!isOnline) {
        await queueCapture({ sku, locationId, reason: 'Other', comment: 'Offline Scan - details needed' });
        toast({
            title: "Queued for Sync",
            description: `Item ${sku} was captured while offline and will be processed later. You can edit the details from the list.`,
            icon: <WifiOff className="h-5 w-5" />
        });
        return;
    }
    
    setIsLoading(true);

    const { data, error } = await getProductData({
      locationId,
      skus: [sku],
      bearerToken: settings.bearerToken,
      debugMode: settings.debugMode,
    });

    setIsLoading(false);

    if (error || !data || data.length === 0) {
        const errText = error || `Could not find product data for EAN: ${sku}`;
        playError();
        toast({
            variant: 'destructive',
            title: 'Product Not Found',
            description: errText,
            duration: 15000,
            action: (
                <ToastAction altText="Copy" onClick={() => navigator.clipboard.writeText(errText)}>
                     <Copy className="mr-2 h-4 w-4" /> Copy
                </ToastAction>
            ),
        });
        setIsScanMode(true); // Re-open scanner on error
    } else {
        const product = data[0];
        
        if (!product.location.standard && product.stockQuantity <= 0) {
            playError();
            toast({ 
                variant: 'destructive', 
                title: 'Item Not Ranged', 
                description: `${product.name} does not seem to be ranged at this store.`,
                icon: <AlertTriangle className="h-5 w-5" />
            });
            setIsScanMode(true); // Re-open scanner on logical error
        } else {
          playSuccess();
          setScannedProduct(product);
          setEditingItem(null);
          
          let defaultReason = '';
          if (product.stockQuantity === 0) {
              defaultReason = 'No Stock';
          }

          reasonForm.reset({ reason: defaultReason, comment: '' });
          setIsModalOpen(true);
          setIsMoreInfoOpen(false);
        }
    }
  }, [form, playError, toast, playSuccess, reasonForm, settings.bearerToken, settings.debugMode, isOnline]);

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
  }
  
  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setScannedProduct(null);
      setEditingItem(null);
      // Re-open scanner when modal is closed, but only if we were in scan mode before
      if (!editingItem) {
          setIsScanMode(true);
      }
    }
  }

  const handleReasonSubmit = (values: z.infer<typeof ReasonSchema>) => {
      if (editingItem) {
        // We are editing an existing item
        const updatedItem: ReportedItem = {
            ...editingItem,
            reason: values.reason,
            comment: values.comment,
        };
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
        setReportedItems(prev => [newReportedItem, ...prev]);
        toast({ title: 'Item Reported', description: `${scannedProduct.name} has been added to the report list.` });
      }
      
      handleModalOpenChange(false);
  }
  
  const handleEditItem = (item: ReportedItem) => {
      setEditingItem(item);
      setScannedProduct(null);
      reasonForm.reset({ reason: item.reason, comment: item.comment || '' });
      setIsModalOpen(true);
      setIsMoreInfoOpen(false);
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

  const handleCopyData = () => {
    const tsv = 'SKU\tName\tStock\tLocation\tReason\tComment\n' + reportedItems.map(p => 
        [
            p.sku,
            p.name.replace(/\s+/g, ' '),
            p.stockQuantity,
            p.location.standard,
            p.reason,
            p.comment || '',
        ].join('\t')
    ).join('\n');

    navigator.clipboard.writeText(tsv).then(() => {
        toast({ title: 'Copied to Clipboard', description: 'The report data has been copied in TSV format.'});
    }).catch(err => {
        toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy data to clipboard.'});
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
        img: p.imageUrl || 'https://placehold.co/100x100.png',
        sku: p.sku,
        name: p.name,
        stock: p.stockQuantity,
        location: p.location.standard || 'N/A',
        reason: p.reason,
        comment: p.comment || ''
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
  
  const productForModal = editingItem || scannedProduct;

  return (
    <div className="min-h-screen bg-background">
      <InstallPrompt />
      {isScanMode && (
         <div className="fixed inset-x-0 top-0 z-50 bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-md mx-auto relative p-0">
                 <ZXingScanner 
                    ref={scannerRef}
                    onResult={(text) => handleScanSuccess(text)} 
                    onError={handleScanError} 
                />
                 <Button variant="ghost" size="icon" onClick={() => setIsScanMode(false)} className="absolute top-2 right-2 z-10 bg-black/20 hover:bg-black/50 text-white hover:text-white">
                    <X className="h-5 w-5" />
                 </Button>
            </div>
        </div>
      )}
      
       <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <Form {...reasonForm}>
            <form onSubmit={reasonForm.handleSubmit(handleReasonSubmit)} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Edit Report' : 'Report Item'}</DialogTitle>
                <DialogDescription>
                  {editingItem ? 'Update the reason for reporting this item.' : 'Select a reason for reporting this item. This will be sent to the supply chain team.'}
                </DialogDescription>
              </DialogHeader>

              {productForModal && (
                  <Collapsible open={isMoreInfoOpen} onOpenChange={setIsMoreInfoOpen}>
                    <div className="flex items-start gap-4 p-4 rounded-md border bg-muted/50">
                        <Image
                          src={productForModal.imageUrl || `https://placehold.co/100x100.png`}
                          alt={productForModal.name}
                          width={80}
                          height={80}
                          className="rounded-md object-cover"
                          data-ai-hint="product image"
                        />
                        <div className="text-sm space-y-1 flex-grow">
                          <p className="font-bold">{productForModal.name}</p>
                           {productForModal.price.promotional && (
                              <div className="pt-1">
                                <Badge variant="destructive" className="bg-accent text-accent-foreground">{productForModal.price.promotional}</Badge>
                              </div>
                            )}
                          <p className="text-lg">Stock: <span className="font-extrabold text-3xl text-primary">{productForModal.stockQuantity}</span></p>
                          <div>Location: <span className="font-semibold">{productForModal.location.standard || 'N/A'}</span></div>
                          {productForModal.location.secondary && <div>Secondary: <span className="font-semibold">{productForModal.location.secondary}</span></div>}
                        </div>
                    </div>
                     <CollapsibleContent>
                        <div className="border-t p-4 space-y-3 text-xs text-muted-foreground overflow-y-auto max-h-60">
                           <div className="grid grid-cols-1 gap-3">
                                <DataRow icon={<Barcode />} label="SKU" value={`${productForModal.sku} (EAN: ${productForModal.scannedSku}) ${productForModal.stockSkuUsed ? `(Stock SKU: ${productForModal.stockSkuUsed})` : ''}`} />
                                <DataRow icon={<Info />} label="Status" value={productForModal.status} />
                                <DataRow icon={<Footprints />} label="Walk Sequence" value={productForModal.walkSequence} />
                                <DataRow icon={<Tag />} label="Promo Location" value={productForModal.location.promotional} />
                                <DataRow icon={<Crown />} label="Brand" value={productForModal.productDetails.brand} />
                                <DataRow icon={<Globe />} label="Country of Origin" value={productForModal.productDetails.countryOfOrigin} />
                                <DataRow icon={<Thermometer />} label="Temperature" value={productForModal.temperature} />
                                <DataRow icon={<Weight />} label="Weight" value={productForModal.weight ? `${productForModal.weight} kg` : null} />
                            </div>

                            <Separator />
                            <div>
                              <h4 className="font-bold mb-3 flex items-center gap-2"><Package className="h-5 w-5" /> Stock & Logistics</h4>
                              <div className="grid grid-cols-1 gap-3">
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
                              </div>
                            </div>
                            
                            {productForModal.productDetails.commercialHierarchy && (
                                <>
                                <Separator />
                                <div>
                                    <h4 className="font-bold mb-3 flex items-center gap-2"><Building2 className="h-5 w-5" /> Classification</h4>
                                    <p className="text-xs">
                                        {productForModal.productDetails.commercialHierarchy.divisionName} &rarr; {productForModal.productDetails.commercialHierarchy.groupName} &rarr; {productForModal.productDetails.commercialHierarchy.className} &rarr; {productForModal.productDetails.commercialHierarchy.subclassName}
                                    </p>
                                </div>
                                </>
                            )}
                             <details className="pt-2">
                                <summary className="cursor-pointer font-semibold">Raw Data</summary>
                                <pre className="mt-2 bg-muted p-2 rounded-md overflow-auto max-h-48 text-[10px] leading-tight">
                                    {JSON.stringify(productForModal, null, 2)}
                                </pre>
                            </details>
                        </div>
                     </CollapsibleContent>
                     <div className="border-t">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full text-xs h-8 text-muted-foreground">
                                {isMoreInfoOpen ? 'Show Less' : 'Show More'}
                                <ChevronDown className={cn("h-4 w-4 ml-2 transition-transform", isMoreInfoOpen && "rotate-180")} />
                            </Button>
                        </CollapsibleTrigger>
                     </div>
                  </Collapsible>
              )}
              
              <div className="px-6 space-y-4">
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

              <DialogFooter>
                <Button type="submit">{editingItem ? 'Update Report' : 'Add to Report'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <main className={cn(
          "container mx-auto px-4 py-8 md:py-12 transition-all duration-300",
          isScanMode && "pt-[calc(100vw/1.77+2rem)] sm:pt-[calc(448px/1.77+2rem)]"
      )}>
        
        <div className={cn(isScanMode && "hidden")}>
          <header className="text-center mb-8">
            <div className="inline-flex items-center gap-3">
               <ServerCrash className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight text-primary">
                Availability Report
              </h1>
            </div>
             <div className="mt-2 space-x-2">
                <Button variant="link" asChild className="text-sm">
                    <Link href="/">
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Go to Picking List
                    </Link>
                </Button>
                <Button variant="link" asChild className="text-sm">
                    <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Link>
                </Button>
            </div>
              {!isOnline && (
                <Alert variant="destructive" className="mt-6 max-w-2xl mx-auto text-left">
                    <WifiOff className="h-4 w-4" />
                    <AlertTitle>You are offline</AlertTitle>
                    <AlertDescription>
                        Scanned items will be queued and processed when you reconnect. Some functionality may be limited.
                    </AlertDescription>
                </Alert>
              )}
          </header>
          
           <Card className="max-w-4xl mx-auto mb-8 shadow-md">
            <CardContent className="p-4">
              <Form {...form}>
                <form className="flex flex-col sm:flex-row items-center gap-4">
                  <FormField
                    control={form.control}
                    name="locationId"
                    render={({ field }) => (
                      <FormItem className="w-full sm:w-auto sm:flex-grow">
                        <FormLabel className="sr-only">Store Location ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Store ID e.g., 218" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <Button
                      type="button"
                      className="w-full sm:w-auto flex-shrink-0"
                      variant='outline'
                      onClick={handleScanButtonClick}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                         <ScanLine className="mr-2 h-4 w-4" />
                      )}
                      {isLoading ? 'Checking...' : 'Scan Item to Report'}
                    </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>


          {reportedItems.length > 0 && 
              <Card className="max-w-4xl mx-auto mb-12 shadow-lg">
                  <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <CardTitle>Reported Items ({reportedItems.length})</CardTitle>
                      <div className="flex flex-wrap items-center gap-2">
                          <Button variant="outline" size="sm" onClick={handleCopyHtml}>
                              <Mail className="mr-2 h-4 w-4" />
                              Copy for Email
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleCopyData}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copy TSV
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Clear
                              </Button>
                            </AlertDialogTrigger>
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
                        <div key={item.reportId} onClick={() => handleEditItem(item)} className="relative flex items-start gap-4 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 z-10" onClick={(e) => handleDeleteItem(e, item.reportId)}>
                            <X className="h-4 w-4" />
                          </Button>
                           <Image
                              src={item.imageUrl || `https://placehold.co/100x100.png`}
                              alt={item.name}
                              width={64}
                              height={64}
                              className="rounded-md object-cover"
                              data-ai-hint="product image small"
                          />
                          <div className="flex-grow">
                             <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-semibold">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                                </div>
                                <Badge variant={item.reason === 'Other' ? 'secondary' : 'default'} className="mr-8">{item.reason}</Badge>
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
          }
      </main>
    </div>
  );
}
