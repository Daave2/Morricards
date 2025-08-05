
'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { type Html5QrcodeScanner } from 'html5-qrcode';
import { getProductData } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useAudioFeedback } from '@/hooks/use-audio-feedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, PackageSearch, Search, ScanLine, Link as LinkIcon, ServerCrash, Trash2, Copy, FileUp, AlertTriangle } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

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


const SCANNER_CONTAINER_ID = 'qr-reader';
const LOCAL_STORAGE_KEY_AVAILABILITY = 'morricards-availability-report';

export default function AvailabilityPage() {
  const [reportedItems, setReportedItems] = useState<ReportedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanMode, setIsScanMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);

  const { toast } = useToast();
  const { playSuccess, playError, playInfo } = useAudioFeedback();

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannedSkusRef = useRef<Set<string>>(new Set());

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


  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
        try {
            scannerRef.current.clear();
        } catch (error) {
            console.warn("Ignoring error during scanner cleanup:", error);
        } finally {
            scannerRef.current = null;
        }
    }
  }, []);
  
  const handleScanSuccess = useCallback(async (decodedText: string) => {
    if (!decodedText || scannedSkusRef.current.has(decodedText)) return;
    
    scannedSkusRef.current.add(decodedText);
    setTimeout(() => scannedSkusRef.current.delete(decodedText), 3000);

    const locationId = form.getValues('locationId');
    if (!locationId) {
        playError();
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter a store location ID before scanning.' });
        return;
    }
    
    setIsLoading(true);

    const { data, error } = await getProductData({ locationId, skus: [decodedText] });

    setIsLoading(false);

    if (error || !data || data.length === 0) {
        playError();
        toast({ variant: 'destructive', title: 'Product Not Found', description: `Could not find product data for EAN: ${decodedText}` });
    } else {
        const product = data[0];
        
        if (!product.location.standard) {
            playError();
            toast({ 
                variant: 'destructive', 
                title: 'Item Not Ranged', 
                description: `${product.name} does not seem to be ranged at this store.`,
                icon: <AlertTriangle className="h-5 w-5" />
            });
            return;
        }

        playSuccess();
        setScannedProduct(product);
        
        let defaultReason = '';
        if (product.stockQuantity === 0) {
            defaultReason = 'No Stock';
        }

        reasonForm.reset({ reason: defaultReason, comment: '' });
        setIsModalOpen(true);
    }
  }, [form, toast, playSuccess, playError, reasonForm]);

  useEffect(() => {
    if (isScanMode) {
      import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
        const onScanFailure = (error: any) => {};
        
        if (!scannerRef.current) {
            scannerRef.current = new Html5QrcodeScanner(
              SCANNER_CONTAINER_ID,
              { 
                fps: 10,
                qrbox: { width: 300, height: 120 },
                rememberLastUsedCamera: true,
                supportedScanTypes: [],
                verbose: false,
              },
              false
            );
        }
        scannerRef.current.render(handleScanSuccess, onScanFailure);
      }).catch(err => {
        console.error("Failed to load html5-qrcode library", err);
        toast({ variant: 'destructive', title: 'Scanner Error', description: 'Could not load the barcode scanner.'})
      });
    } else {
        stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isScanMode, handleScanSuccess, toast, stopScanner]);

  
  const handleReasonSubmit = (values: z.infer<typeof ReasonSchema>) => {
      if (!scannedProduct) return;
      
      const newReportedItem: ReportedItem = {
          ...scannedProduct,
          reason: values.reason,
          comment: values.comment,
      };

      setReportedItems(prev => [newReportedItem, ...prev]);
      toast({ title: 'Item Reported', description: `${scannedProduct.name} has been added to the report list.` });
      setIsModalOpen(false);
      setScannedProduct(null);
  }

  const handleScanButtonClick = () => {
    if (isScanMode) {
      setIsScanMode(false);
    } else {
      scannedSkusRef.current = new Set();
      setIsScanMode(true);
    }
  }

  const handleClearList = () => {
    setReportedItems([]);
    toast({
        title: 'List Cleared',
        description: 'The report list has been cleared.',
    });
  }

  const handleCopyData = () => {
    const tsv = 'SKU\tEAN\tName\tStock\tLocation\tReason\tComment\n' + reportedItems.map(p => 
        [
            p.sku,
            p.scannedSku,
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

  return (
    <div className="min-h-screen bg-background">
       <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
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
                      <div className="text-sm space-y-1">
                        <p className="font-bold">{scannedProduct.name}</p>
                        <p className="text-lg">Stock: <span className="font-extrabold text-3xl text-primary">{scannedProduct.stockQuantity}</span></p>
                        <p>Location: <span className="font-semibold">{scannedProduct.location.standard || 'N/A'}</span></p>
                      </div>
                  </div>
              )}
              
              <FormField
                control={reasonForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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

              <DialogFooter>
                <Button type="submit">Add to Report</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <main className="container mx-auto px-4 py-8 md:py-12">
        {isScanMode && (
          <div className="sticky top-0 z-50 py-4 bg-background -mx-4 px-4 mb-4">
            <div className="max-w-md mx-auto rounded-lg overflow-hidden shadow-lg border h-[200px] flex items-center justify-center bg-black [&>span]:hidden">
              <div id={SCANNER_CONTAINER_ID} className="w-[350px] h-[350px]"></div>
            </div>
          </div>
        )}
        <div className={isScanMode ? 'pt-4' : ''}>
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
              <CardTitle>Scan Item to Report</CardTitle>
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
                      variant={isScanMode ? 'destructive' : 'default'}
                      onClick={handleScanButtonClick}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                         <ScanLine className="mr-2 h-4 w-4" />
                      )}
                      {isLoading ? 'Checking...' : isScanMode ? 'Close Scanner' : 'Start Scanning'}
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
                          <Button variant="outline" size="sm" onClick={handleCopyData}>
                              <FileUp className="mr-2 h-4 w-4" />
                              Copy
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
                                {reportedItems.map(item => (
                                    <TableRow key={item.sku}>
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
