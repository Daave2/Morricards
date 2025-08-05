
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
import { Loader2, PackageSearch, Search, ScanLine, Link as LinkIcon, ServerCrash, Trash2, Copy, FileUp, AlertTriangle, Mail, ChevronDown, Barcode, Footprints, Tag, Thermometer, Weight, Info, Crown, Globe, Package, CalendarClock, Flag, Building2, Layers, Leaf, Shell, Beaker, History, CameraOff, Zap, X } from 'lucide-react';
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

type Product = FetchMorrisonsDataOutput[0];
type ReportedItem = Product & { reason: string; comment?: string };

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
  
  const { toast } = useToast();
  const { playSuccess, playError } = useAudioFeedback();

  const scannerRef = useRef<{ start: () => void } | null>(null);

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
    
    setIsLoading(true);

    const { data, error } = await getProductData({ locationId, skus: [sku] });

    setIsLoading(false);

    if (error || !data || data.length === 0) {
        playError();
        toast({ variant: 'destructive', title: 'Product Not Found', description: `Could not find product data for EAN: ${sku}` });
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
          
          let defaultReason = '';
          if (product.stockQuantity === 0) {
              defaultReason = 'No Stock';
          }

          reasonForm.reset({ reason: defaultReason, comment: '' });
          setIsModalOpen(true);
          setIsMoreInfoOpen(false);
        }
    }
  }, [form, playError, toast, playSuccess, reasonForm]);

  const handleScanError = (message: string) => {
    if (!message.toLowerCase().includes('not found')) {
      toast({
        variant: 'destructive',
        title: 'Scanner Error',
        description: message,
      });
    }
  }
  
  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      // Re-open scanner when modal is closed
      setIsScanMode(true);
    }
  }

  const handleReasonSubmit = (values: z.infer<typeof ReasonSchema>) => {
      if (!scannedProduct) return;
      
      const newReportedItem: ReportedItem = {
          ...scannedProduct,
          reason: values.reason,
          comment: values.comment,
      };

      setReportedItems(prev => [newReportedItem, ...prev]);
      toast({ title: 'Item Reported', description: `${scannedProduct.name} has been added to the report list.` });
      handleModalOpenChange(false);
      setScannedProduct(null);
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

  const handleCopyHtml = () => {
    const styles = {
        table: 'border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: 12px;',
        th: 'border: 1px solid #dddddd; text-align: left; padding: 8px; background-color: #f2f2f2;',
        td: 'border: 1px solid #dddddd; text-align: left; padding: 8px;',
        img: 'width: 50px; height: 50px; object-fit: cover; border-radius: 4px;'
    };

    const html = `
        <table style="${styles.table}">
            <thead>
                <tr>
                    <th style="${styles.th}">Image</th>
                    <th style="${styles.th}">SKU</th>
                    <th style="${styles.th}">Name</th>
                    <th style="${styles.th}">Stock</th>
                    <th style="${styles.th}">Location</th>
                    <th style="${styles.th}">Reason</th>
                    <th style="${styles.th}">Comment</th>
                </tr>
            </thead>
            <tbody>
                ${reportedItems.map(p => `
                    <tr>
                        <td style="${styles.td}"><img src="${p.imageUrl || 'https://placehold.co/100x100.png'}" alt="${p.name}" style="${styles.img}" /></td>
                        <td style="${styles.td}">${p.sku}</td>
                        <td style="${styles.td}">${p.name}</td>
                        <td style="${styles.td}">${p.stockQuantity}</td>
                        <td style="${styles.td}">${p.location.standard}</td>
                        <td style="${styles.td}">${p.reason}</td>
                        <td style="${styles.td}">${p.comment || ''}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);
    tempDiv.innerHTML = html;

    const range = document.createRange();
    range.selectNodeContents(tempDiv);
    const selection = window.getSelection();
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            toast({ title: 'Copied for Email', description: 'HTML table copied to clipboard.' });
        } else {
             toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy HTML to clipboard.' });
        }
    } catch (err) {
        console.error('Copy failed:', err);
        toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy HTML to clipboard.' });
    } finally {
        document.body.removeChild(tempDiv);
        if (window.getSelection()) {
            window.getSelection()?.removeAllRanges();
        }
    }
  }


  return (
    <div className="min-h-screen bg-background">
      {isScanMode && (
         <div className="fixed inset-x-0 top-0 z-50">
            <div className="bg-background/80 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-2 flex justify-between items-center">
                   <h2 className="text-lg font-medium">Scan Barcode</h2>
                   <Button variant="ghost" size="icon" onClick={() => setIsScanMode(false)}>
                       <X className="h-5 w-5" />
                   </Button>
               </div>
            </div>
             <div className="p-4 bg-background/80 backdrop-blur-sm">
                <div className="w-full max-w-md mx-auto">
                     <ZXingScanner 
                        ref={scannerRef}
                        onResult={(text) => handleScanSuccess(text)} 
                        onError={handleScanError} 
                    />
                </div>
            </div>
        </div>
      )}
      
       <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <Form {...reasonForm}>
            <form onSubmit={reasonForm.handleSubmit(handleReasonSubmit)} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Report Item</DialogTitle>
                <DialogDescription>
                  Select a reason for reporting this item. This will be sent to the supply chain team.
                </DialogDescription>
              </DialogHeader>

              {scannedProduct && (
                  <Collapsible open={isMoreInfoOpen} onOpenChange={setIsMoreInfoOpen}>
                    <div className="flex items-start gap-4 p-4 rounded-md border bg-muted/50">
                        <Image
                          src={scannedProduct.imageUrl || `https://placehold.co/100x100.png`}
                          alt={scannedProduct.name}
                          width={80}
                          height={80}
                          className="rounded-md object-cover"
                          data-ai-hint="product image"
                          unoptimized
                        />
                        <div className="text-sm space-y-1 flex-grow">
                          <p className="font-bold">{scannedProduct.name}</p>
                           {scannedProduct.price.promotional && (
                              <div className="pt-1">
                                <Badge variant="destructive" className="bg-accent text-accent-foreground">{scannedProduct.price.promotional}</Badge>
                              </div>
                            )}
                          <p className="text-lg">Stock: <span className="font-extrabold text-3xl text-primary">{scannedProduct.stockQuantity}</span></p>
                          <div>Location: <span className="font-semibold">{scannedProduct.location.standard || 'N/A'}</span></div>
                          {scannedProduct.location.secondary && <div>Secondary: <span className="font-semibold">{scannedProduct.location.secondary}</span></div>}
                        </div>
                    </div>
                     <CollapsibleContent>
                        <div className="border-t p-4 space-y-3 text-xs text-muted-foreground overflow-y-auto max-h-60">
                           <div className="grid grid-cols-1 gap-3">
                                <DataRow icon={<Barcode />} label="SKU" value={`${scannedProduct.sku} (EAN: ${scannedProduct.scannedSku}) ${scannedProduct.stockSkuUsed ? `(Stock SKU: ${scannedProduct.stockSkuUsed})` : ''}`} />
                                <DataRow icon={<Info />} label="Status" value={scannedProduct.status} />
                                <DataRow icon={<Footprints />} label="Walk Sequence" value={scannedProduct.walkSequence} />
                                <DataRow icon={<Tag />} label="Promo Location" value={scannedProduct.location.promotional} />
                                <DataRow icon={<Crown />} label="Brand" value={scannedProduct.productDetails.brand} />
                                <DataRow icon={<Globe />} label="Country of Origin" value={scannedProduct.productDetails.countryOfOrigin} />
                                <DataRow icon={<Thermometer />} label="Temperature" value={scannedProduct.temperature} />
                                <DataRow icon={<Weight />} label="Weight" value={scannedProduct.weight ? `${scannedProduct.weight} kg` : null} />
                            </div>

                            <Separator />
                            <div>
                              <h4 className="font-bold mb-3 flex items-center gap-2"><Package className="h-5 w-5" /> Stock & Logistics</h4>
                              <div className="grid grid-cols-1 gap-3">
                                 {scannedProduct.lastStockChange?.lastCountDateTime && (
                                    <DataRow
                                        icon={<History />}
                                        label="Last Stock Event"
                                        value={`${scannedProduct.lastStockChange.inventoryAction} of ${scannedProduct.lastStockChange.qty} by ${scannedProduct.lastStockChange.createdBy} at ${scannedProduct.lastStockChange.lastCountDateTime}`}
                                    />
                                  )}
                                 <DataRow icon={<Layers />} label="Storage" value={scannedProduct.productDetails.storage?.join(', ')} />
                                 <DataRow icon={<Layers />} label="Pack Info" value={scannedProduct.productDetails.packs?.map(p => `${p.packQuantity}x ${p.packNumber}`).join('; ')} />
                                 <DataRow icon={<CalendarClock />} label="Min Life (CPC/CFC)" value={scannedProduct.productDetails.productLife ? `${scannedProduct.productDetails.productLife.minimumCPCAcceptanceLife} / ${scannedProduct.productDetails.productLife.minimumCFCAcceptanceLife} days` : null} />
                                 <DataRow icon={<Flag />} label="Perishable" value={scannedProduct.productDetails.productFlags?.perishableInd ? 'Yes' : 'No'} />
                                 <DataRow icon={<Flag />} label="Manual Order" value={scannedProduct.productDetails.manuallyStoreOrderedItem} />
                              </div>
                            </div>
                            
                            {scannedProduct.productDetails.commercialHierarchy && (
                                <>
                                <Separator />
                                <div>
                                    <h4 className="font-bold mb-3 flex items-center gap-2"><Building2 className="h-5 w-5" /> Classification</h4>
                                    <p className="text-xs">
                                        {scannedProduct.productDetails.commercialHierarchy.divisionName} &rarr; {scannedProduct.productDetails.commercialHierarchy.groupName} &rarr; {scannedProduct.productDetails.commercialHierarchy.className} &rarr; {scannedProduct.productDetails.commercialHierarchy.subclassName}
                                    </p>
                                </div>
                                </>
                            )}
                             <details className="pt-2">
                                <summary className="cursor-pointer font-semibold">Raw Data</summary>
                                <pre className="mt-2 bg-muted p-2 rounded-md overflow-auto max-h-48 text-[10px] leading-tight">
                                    {JSON.stringify(scannedProduct, null, 2)}
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
                <Button type="submit">Add to Report</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <main className="container mx-auto px-4 py-8 md:py-12">
        
        <div>
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-4">
               <ServerCrash className="w-12 h-12 text-primary" />
              <h1 className="text-5xl font-bold tracking-tight text-primary">
                Availability <span className="text-foreground">Report</span>
              </h1>
            </div>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Scan products and report availability issues to the supply chain team.
            </p>
             <Button variant="link" asChild className="mt-2">
                <Link href="/">
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Go to Picking List
                </Link>
            </Button>
          </header>
          
          <Card className="max-w-4xl mx-auto mb-12 shadow-lg">
            <CardHeader>
              <CardTitle>Item Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form className="space-y-6">
                  <FormField
                    control={form.control}
                    name="locationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store Location ID</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 218" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <Button
                      type="button"
                      className="w-full"
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

          {reportedItems.length > 0 && 
              <Card className="max-w-4xl mx-auto mb-12 shadow-lg">
                  <CardHeader className="flex-row items-center justify-between">
                      <CardTitle>Reported Items ({reportedItems.length})</CardTitle>
                      <div className="flex items-center gap-2">
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
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">Image</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Stock</TableHead>
                                    <TableHead>Reason</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportedItems.map((item, index) => (
                                    <TableRow key={`${item.sku}-${index}`}>
                                        <TableCell>
                                             <Image
                                                src={item.imageUrl || `https://placehold.co/100x100.png`}
                                                alt={item.name}
                                                width={40}
                                                height={40}
                                                className="rounded-md object-cover"
                                                data-ai-hint="product image small"
                                                unoptimized
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{item.name}</div>
                                            <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
                                        </TableCell>
                                        <TableCell>{item.stockQuantity}</TableCell>
                                        <TableCell>
                                            <Badge variant={item.reason === 'Other' ? 'secondary' : 'default'}>{item.reason}</Badge>
                                            {item.comment && <p className="text-xs text-muted-foreground mt-1">{item.comment}</p>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                  </CardContent>
              </Card>
          }
        </div>
      </main>
    </div>
  );
}

    