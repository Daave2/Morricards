
'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/src/firebase';
import { useApiSettings } from '@/hooks/use-api-settings';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, Search, ScanLine, X, Text } from 'lucide-react';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ProductCard from '@/components/product-card';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ZXingScanner from '@/components/ZXingScanner';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

type Product = FetchMorrisonsDataOutput[0];

interface OrderProduct {
    sku: string;
    name: string;
    quantity: number;
    details?: Product | null;
    prePickedStatus?: {
        isPrePicked: boolean;
        storageLocation?: string | null;
    }
}

interface Order {
    id: string;
    collectionSlot: string;
    products: OrderProduct[];
}

interface ProductSummary {
    sku: string;
    name: string;
    location: string;
    total: number;
    orders: Set<string>;
    details: Product | null;
    prePickedState?: {
        isPrePicked: boolean;
        storageLocation?: string | null;
    }
}

const UnloadView = ({
    items,
    onAssignLocation
}: {
    items: ProductSummary[];
    onAssignLocation: (skus: string[], location: string) => void;
}) => {
    const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
    const [isScannerActive, setIsScannerActive] = useState(false);
    const [manualLocation, setManualLocation] = useState('');
    const scannerRef = useRef<{ start: () => void; stop: () => void; getOcrDataUri: () => string | null; } | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (isScannerActive) {
            scannerRef.current?.start();
        } else {
            scannerRef.current?.stop();
        }
    }, [isScannerActive]);

    const handleAssign = (location: string) => {
        if (selectedSkus.size === 0) {
            toast({ variant: 'destructive', title: 'No Items Selected', description: 'Please select items to unload before assigning a location.' });
            return;
        }
        if (!location.trim()) {
            toast({ variant: 'destructive', title: 'No Location', description: 'Please enter a location to assign.' });
            return;
        }
        onAssignLocation(Array.from(selectedSkus), location);
        setSelectedSkus(new Set());
        setManualLocation('');
        setIsScannerActive(false);
        toast({ title: 'Location Assigned', description: `${selectedSkus.size} items have been assigned to ${location}.` });
    }

    const toggleSku = (sku: string) => {
        setSelectedSkus(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sku)) {
                newSet.delete(sku);
            } else {
                newSet.add(sku);
            }
            return newSet;
        });
    };
    
    const toggleGroup = (groupItems: ProductSummary[], checked: boolean) => {
        setSelectedSkus(prev => {
            const newSet = new Set(prev);
            groupItems.forEach(item => {
                if (checked) {
                    newSet.add(item.sku);
                } else {
                    newSet.delete(item.sku);
                }
            });
            return newSet;
        });
    };
    
    const groupedItems = useMemo(() => {
        const groups: Record<string, ProductSummary[]> = {};
        items.forEach(item => {
            const classification = item.details?.productDetails?.commercialHierarchy?.groupName?.replace(/^\d+\s/, '') || 'Unclassified';
            if (!groups[classification]) {
                groups[classification] = [];
            }
            groups[classification].push(item);
        });
        return groups;
    }, [items]);

    if (items.length === 0) {
        return <p className="text-muted-foreground text-center py-8">All pre-picked items have been unloaded.</p>;
    }

    return (
        <div className="space-y-6">
            {Object.entries(groupedItems).map(([classification, groupItems]) => {
                const areAllSelected = groupItems.every(item => selectedSkus.has(item.sku));
                return (
                    <Card key={classification}>
                        <CardHeader className="flex flex-row items-center justify-between p-4">
                            <CardTitle className="text-lg">{classification}</CardTitle>
                             <div className="flex items-center space-x-2">
                                <label htmlFor={`select-all-${classification}`} className="text-sm font-medium">Select All</label>
                                <Checkbox
                                    id={`select-all-${classification}`}
                                    checked={areAllSelected}
                                    onCheckedChange={(checked) => toggleGroup(groupItems, !!checked)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2 p-4 pt-0">
                            {groupItems.map(item => (
                                <div key={item.sku} className="flex items-center gap-4 p-2 rounded-md hover:bg-accent">
                                    <Checkbox checked={selectedSkus.has(item.sku)} onCheckedChange={() => toggleSku(item.sku)} id={`check-${item.sku}`} />
                                    <label htmlFor={`check-${item.sku}`} className="flex items-center gap-4 cursor-pointer flex-grow">
                                        <Image src={item.details?.productDetails.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'} alt={item.name} width={40} height={40} className="rounded-md border object-cover" />
                                        <div>
                                            <p className="font-medium text-sm">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">SKU: {item.sku} | Qty: {item.total}</p>
                                        </div>
                                    </label>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                );
            })}
             <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm p-4 border-t -m-6 mt-6">
                {isScannerActive ? (
                    <div className="space-y-2">
                        <ZXingScanner ref={scannerRef} onResult={(text) => handleAssign(text)} onError={(e) => console.warn(e)} />
                        <Button variant="secondary" className="w-full" onClick={() => setIsScannerActive(false)}>Cancel Scan</Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                         <div className="flex gap-2">
                             <Input
                                placeholder="Or type location..."
                                value={manualLocation}
                                onChange={(e) => setManualLocation(e.target.value)}
                                disabled={selectedSkus.size === 0}
                            />
                            <Button onClick={() => handleAssign(manualLocation)} disabled={selectedSkus.size === 0 || !manualLocation.trim()}>
                                <Text className="mr-2 h-4 w-4" /> Assign
                            </Button>
                         </div>
                        <Button className="w-full" size="lg" onClick={() => setIsScannerActive(true)} disabled={selectedSkus.size === 0}>
                            <ScanLine className="mr-2 h-5 w-5" />
                            Scan Location QR ({selectedSkus.size} items selected)
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};


export default function DailyReportClient({ date }: { date: string }) {
    const { settings } = useApiSettings();
    const firestore = useFirestore();
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [sortConfig, setSortConfig] = useState('total-desc');
    const [filterQuery, setFilterQuery] = useState('');
    const [aisleFilter, setAisleFilter] = useState('all');
    const [classificationFilter, setClassificationFilter] = useState('all');
    const [isUnloadViewOpen, setIsUnloadViewOpen] = useState(false);


    const ordersCollectionRef = useMemoFirebase(
        () => settings.locationId ? collection(firestore, `stores/${settings.locationId}/pickingOrders`) : null,
        [firestore, settings.locationId]
    );

    const { data: allOrders, isLoading: isDbLoading } = useCollection<Order>(ordersCollectionRef);

    const ordersForDay = useMemo(() => {
        if (!allOrders) return [];
        return allOrders.filter(order => order.collectionSlot.includes(date));
    }, [allOrders, date]);


    const productSummary = useMemo(() => {
        if (!ordersForDay) return {};

        const summary: Record<string, ProductSummary> = {};

        ordersForDay.forEach(order => {
            order.products.forEach(product => {
                if (!summary[product.sku]) {
                    summary[product.sku] = {
                        sku: product.sku,
                        name: product.name,
                        location: product.details?.location.standard || 'N/A',
                        total: 0,
                        orders: new Set<string>(),
                        details: product.details || null,
                        prePickedState: product.prePickedStatus // Initialize from first product found
                    };
                }
                summary[product.sku].total += product.quantity;
                summary[product.sku].orders.add(order.id);
                // If we find any pre-picked status for this SKU, we use it.
                // This assumes pre-pick status is consistent per SKU for the day.
                if (product.prePickedStatus) {
                    summary[product.sku].prePickedState = product.prePickedStatus;
                }
            });
        });

        return summary;
    }, [ordersForDay]);

    const availableAisles = useMemo(() => {
        const aisles = new Set<string>();
        Object.values(productSummary).forEach(p => {
            const aisleMatch = p.location.match(/Aisle\s*\d+/i);
            if (aisleMatch) {
                aisles.add(aisleMatch[0]);
            }
        });
        return Array.from(aisles).sort((a,b) => parseInt(a.replace('Aisle ', '')) - parseInt(b.replace('Aisle ', '')));
    }, [productSummary]);
    
    const availableClassifications = useMemo(() => {
        const classifications = new Set<string>();
        Object.values(productSummary).forEach(p => {
            const groupName = p.details?.productDetails?.commercialHierarchy?.groupName?.replace(/^\d+\s/, '');
            if (groupName) {
                classifications.add(groupName);
            }
        });
        return Array.from(classifications).sort();
    }, [productSummary]);

    const sortedAndFilteredProducts = useMemo(() => {
        let filteredProducts = Object.values(productSummary);

        if (filterQuery) {
            filteredProducts = filteredProducts.filter(p => 
                p.name.toLowerCase().includes(filterQuery.toLowerCase()) || 
                p.sku.includes(filterQuery)
            );
        }

        if (aisleFilter !== 'all') {
            filteredProducts = filteredProducts.filter(p => p.location.includes(aisleFilter));
        }

        if (classificationFilter !== 'all') {
            filteredProducts = filteredProducts.filter(p => {
                const groupName = p.details?.productDetails?.commercialHierarchy?.groupName?.replace(/^\d+\s/, '');
                return groupName === classificationFilter;
            });
        }

        const [key, direction] = sortConfig.split('-');

        filteredProducts.sort((a, b) => {
            const aIsPrePicked = a.prePickedState?.isPrePicked;
            const bIsPrePicked = b.prePickedState?.isPrePicked;
            
            if (aIsPrePicked && !bIsPrePicked) return 1;
            if (!aIsPrePicked && bIsPrePicked) return -1;
            
            let valA: any;
            let valB: any;

            switch(key) {
                case 'total':
                    valA = a.total;
                    valB = b.total;
                    break;
                case 'orders':
                    valA = a.orders.size;
                    valB = b.orders.size;
                    break;
                case 'name':
                    valA = a.name.toLowerCase();
                    valB = b.name.toLowerCase();
                    break;
                case 'location':
                    valA = a.location.toLowerCase();
                    valB = b.location.toLowerCase();
                    break;
                default: 
                    return 0;
            }
            
            if (typeof valA === 'string') {
                return direction === 'asc' ? valA.localeCompare(valA) : valB.localeCompare(valA);
            }
            return direction === 'asc' ? valA - valB : valB - valA;
        });

        return filteredProducts;
    }, [productSummary, filterQuery, sortConfig, aisleFilter, classificationFilter]);

    const updatePrePickedStatusInDb = useCallback(async (sku: string, newStatus: OrderProduct['prePickedStatus']) => {
        if (!firestore || !settings.locationId) return;
    
        // FIRESTORE FIX: Ensure storageLocation is null, not undefined
        const statusToSave: OrderProduct['prePickedStatus'] = {
            isPrePicked: newStatus?.isPrePicked || false,
            storageLocation: newStatus?.storageLocation || null,
        };

        const batch = writeBatch(firestore);
        const productOrders = productSummary[sku]?.orders;

        if (productOrders) {
            productOrders.forEach(orderId => {
                const orderRef = doc(firestore, `stores/${settings.locationId}/pickingOrders`, orderId);
                const orderData = ordersForDay.find(o => o.id === orderId);
                if (orderData) {
                    const updatedProducts = orderData.products.map(p => {
                        if (p.sku === sku) {
                            return { ...p, prePickedStatus: statusToSave };
                        }
                        return p;
                    });
                    batch.update(orderRef, { products: updatedProducts });
                }
            });
            await batch.commit();
        }
    }, [firestore, settings.locationId, ordersForDay, productSummary]);


    const handlePrePickToggle = (sku: string) => {
        const currentState = productSummary[sku]?.prePickedState;
        const newStatus = {
            isPrePicked: !currentState?.isPrePicked,
            storageLocation: currentState?.storageLocation
        };
        updatePrePickedStatusInDb(sku, newStatus);
    };

    const handleAssignLocation = (skus: string[], location: string) => {
        skus.forEach(sku => {
             const newStatus = {
                isPrePicked: true,
                storageLocation: location || null // Ensure null instead of empty string
            };
            updatePrePickedStatusInDb(sku, newStatus);
        });
    };

    const handleExportCSV = () => {
        const csvHeader = "Name,SKU,Location,TotalOrdered,OrderCount,PrePicked,StorageLocation\n";
        const csvRows = sortedAndFilteredProducts.map((summary) => {
            const state = summary.prePickedState;
            const row = [
                `"${summary.name.replace(/"/g, '""')}"`,
                summary.sku,
                `"${summary.location.replace(/"/g, '""')}"`,
                summary.total,
                summary.orders.size,
                state?.isPrePicked ? 'Yes' : 'No',
                state?.storageLocation || ''
            ];
            return row.join(',');
        });

        const csvContent = csvHeader + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `daily_order_report_${date}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    
    if (isDbLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading Orders...</p>
                </div>
            </div>
        )
    }

    const unlocatedPrePicks = sortedAndFilteredProducts.filter(p => p.prePickedState?.isPrePicked && !p.prePickedState?.storageLocation);

    return (
        <main className="container mx-auto px-4 py-8 md:py-12">
            <Dialog open={!!selectedProduct} onOpenChange={(isOpen) => !isOpen && setSelectedProduct(null)}>
                 <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedProduct?.name || 'Product Details'}</DialogTitle>
                        <DialogDescription>
                            SKU: {selectedProduct?.sku || 'N/A'}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedProduct && (
                        <ProductCard
                            product={selectedProduct}
                            layout="grid"
                            isPicker={false}
                            locationId={settings.locationId}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isUnloadViewOpen} onOpenChange={setIsUnloadViewOpen}>
                <DialogContent className="max-w-2xl">
                     <DialogHeader>
                        <DialogTitle>Unload Pre-picked Items</DialogTitle>
                        <DialogDescription>
                            Select items and scan a location QR code to assign them to a storage spot.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mx-6">
                        <div className="px-6">
                            <UnloadView items={unlocatedPrePicks} onAssignLocation={handleAssignLocation} />
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <CardTitle>Item List</CardTitle>
                            <CardDescription>Aggregated product list for {date}</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => setIsUnloadViewOpen(true)} disabled={unlocatedPrePicks.length === 0}>
                                <ScanLine className="mr-2 h-4 w-4" />
                                Unload Items ({unlocatedPrePicks.length})
                            </Button>
                            <Button variant="outline" onClick={handleExportCSV} disabled={sortedAndFilteredProducts.length === 0}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Export CSV
                            </Button>
                            <Button asChild variant="secondary">
                               <Link href="/picking">Back to Picking</Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                placeholder="Filter by name or SKU..."
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                className="pl-10"
                            />
                             {filterQuery && (
                                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setFilterQuery('')}>
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter by classification..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Classifications</SelectItem>
                                    {availableClassifications.map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={aisleFilter} onValueChange={setAisleFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter by aisle..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Aisles</SelectItem>
                                    {availableAisles.map(aisle => (
                                        <SelectItem key={aisle} value={aisle}>{aisle}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={sortConfig} onValueChange={setSortConfig}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sort by..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="total-desc">Total Ordered (High to Low)</SelectItem>
                                    <SelectItem value="total-asc">Total Ordered (Low to High)</SelectItem>
                                    <SelectItem value="orders-desc"># of Orders (High to Low)</SelectItem>
                                    <SelectItem value="orders-asc"># of Orders (Low to High)</SelectItem>
                                    <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                                    <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                                    <SelectItem value="location-asc">Location</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="hidden md:block border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[60px]">Pre-picked</TableHead>
                                    <TableHead className="w-[100px]">Image</TableHead>
                                    <TableHead>Product Name</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead className="text-right">Total Ordered</TableHead>
                                    <TableHead className="text-right">In # Orders</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedAndFilteredProducts.length > 0 ? sortedAndFilteredProducts.map((summary) => {
                                    const isPrePicked = !!summary.prePickedState?.isPrePicked;
                                    return (
                                        <TableRow
                                            key={summary.sku}
                                            className={cn(
                                                "cursor-pointer",
                                                isPrePicked && 'bg-green-100/50 dark:bg-green-900/20 opacity-60 hover:opacity-100 hover:bg-green-100/80'
                                            )}
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={isPrePicked}
                                                    onCheckedChange={() => handlePrePickToggle(summary.sku)}
                                                    className="h-6 w-6"
                                                />
                                            </TableCell>
                                            <TableCell onClick={() => summary.details && setSelectedProduct(summary.details)}>
                                                <Image
                                                    src={summary.details?.productDetails?.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'}
                                                    alt={summary.name}
                                                    width={60}
                                                    height={60}
                                                    className="rounded-md border object-cover"
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium" onClick={() => summary.details && setSelectedProduct(summary.details)}>
                                                {summary.name}
                                                <p className="text-xs text-muted-foreground">SKU: {summary.sku}</p>
                                            </TableCell>
                                            <TableCell onClick={() => summary.details && setSelectedProduct(summary.details)}>
                                                {summary.location}
                                                {summary.prePickedState?.storageLocation && <div className="text-xs font-semibold text-primary mt-1 p-1 bg-primary/10 rounded-md">{summary.prePickedState.storageLocation}</div>}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-lg" onClick={() => summary.details && setSelectedProduct(summary.details)}>{summary.total}</TableCell>
                                            <TableCell className="text-right" onClick={() => summary.details && setSelectedProduct(summary.details)}>{summary.orders.size}</TableCell>
                                        </TableRow>
                                    )
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No orders found for this date or filter.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="block md:hidden space-y-4">
                         {sortedAndFilteredProducts.length > 0 ? sortedAndFilteredProducts.map((summary) => {
                                const isPrePicked = !!summary.prePickedState?.isPrePicked;
                                return (
                                    <Card 
                                        key={summary.sku} 
                                        className={cn(isPrePicked && 'bg-green-100/50 dark:bg-green-900/20 opacity-70')}
                                        onClick={() => summary.details && setSelectedProduct(summary.details)}
                                    >
                                        <CardContent className="p-3">
                                            <div className="flex gap-4">
                                                <div className="flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        checked={isPrePicked}
                                                        onCheckedChange={() => handlePrePickToggle(summary.sku)}
                                                        className="h-6 w-6"
                                                    />
                                                    <Image
                                                        src={summary.details?.productDetails?.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'}
                                                        alt={summary.name}
                                                        width={80}
                                                        height={80}
                                                        className="rounded-md border object-cover"
                                                    />
                                                </div>
                                                <div className="flex-grow space-y-1">
                                                    <p className="font-semibold leading-tight">{summary.name}</p>
                                                    <p className="text-xs text-muted-foreground">SKU: {summary.sku}</p>
                                                    <p className="text-sm"><strong>Location:</strong> {summary.location}</p>
                                                     {summary.prePickedState?.storageLocation && <div className="text-xs font-semibold text-primary mt-1 p-1 bg-primary/10 rounded-md w-fit">{summary.prePickedState.storageLocation}</div>}
                                                    <div className="flex items-center justify-between pt-2">
                                                        <div className="text-center">
                                                            <p className="font-bold text-2xl text-primary">{summary.total}</p>
                                                            <p className="text-xs text-muted-foreground">Total Units</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="font-bold text-xl">{summary.orders.size}</p>
                                                            <p className="text-xs text-muted-foreground">Orders</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                         }) : (
                             <div className="text-center p-8 text-muted-foreground">
                                No orders found for this date or filter.
                             </div>
                         )}
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
