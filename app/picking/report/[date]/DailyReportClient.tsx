
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/src/firebase';
import { useApiSettings } from '@/hooks/use-api-settings';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProductCard from '@/components/product-card';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Product = FetchMorrisonsDataOutput[0];

interface OrderProduct {
    sku: string;
    name: string;
    quantity: number;
    details?: Product | null;
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
}

export default function DailyReportClient({ date }: { date: string }) {
    const { settings } = useApiSettings();
    const firestore = useFirestore();
    const [prePickedSkus, setPrePickedSkus] = useState<Set<string>>(new Set());
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [sortConfig, setSortConfig] = useState('total-desc');
    const [filterQuery, setFilterQuery] = useState('');
    const [aisleFilter, setAisleFilter] = useState('all');
    const [classificationFilter, setClassificationFilter] = useState('all');


    const storageKey = `daily-report-prepicked-${date}`;

    useEffect(() => {
        const savedState = localStorage.getItem(storageKey);
        if (savedState) {
            setPrePickedSkus(new Set(JSON.parse(savedState)));
        }
    }, [storageKey]);

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(prePickedSkus)));
    }, [prePickedSkus, storageKey]);


    const ordersCollectionRef = useMemoFirebase(
        () => settings.locationId ? collection(firestore, `stores/${settings.locationId}/pickingOrders`) : null,
        [firestore, settings.locationId]
    );

    const { data: allOrders, isLoading: isDbLoading } = useCollection<Order>(ordersCollectionRef);

    const productSummary = useMemo(() => {
        if (!allOrders) return {};

        const summary: Record<string, ProductSummary> = {};

        const ordersForDay = allOrders.filter(order => order.collectionSlot.includes(date));

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
                    };
                }
                summary[product.sku].total += product.quantity;
                summary[product.sku].orders.add(order.id);
            });
        });

        return summary;
    }, [allOrders, date]);

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
            const aIsPrePicked = prePickedSkus.has(a.sku);
            const bIsPrePicked = prePickedSkus.has(b.sku);

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
                return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return direction === 'asc' ? valA - valB : valB - valA;
        });

        return filteredProducts;
    }, [productSummary, prePickedSkus, filterQuery, sortConfig, aisleFilter, classificationFilter]);

    const handlePrePickToggle = (sku: string) => {
        setPrePickedSkus(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sku)) {
                newSet.delete(sku);
            } else {
                newSet.add(sku);
            }
            return newSet;
        });
    };

    const handleExportCSV = () => {
        const csvHeader = "Name,SKU,Location,TotalOrdered,OrderCount,PrePicked\n";
        const csvRows = sortedAndFilteredProducts.map((summary) => {
            const row = [
                `"${summary.name.replace(/"/g, '""')}"`,
                summary.sku,
                `"${summary.location.replace(/"/g, '""')}"`,
                summary.total,
                summary.orders.size,
                prePickedSkus.has(summary.sku) ? 'Yes' : 'No'
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
            <Card>
                <CardHeader className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <CardTitle>Daily Order Report</CardTitle>
                        <CardDescription>Aggregated product list for {date}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={handleExportCSV} disabled={sortedAndFilteredProducts.length === 0}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                        <Button asChild variant="secondary">
                           <Link href="/picking">Back to Picking</Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                placeholder="Filter by name or SKU..."
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                         <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                            <SelectTrigger className="w-full sm:w-[220px]">
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
                            <SelectTrigger className="w-full sm:w-[180px]">
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
                            <SelectTrigger className="w-full sm:w-[240px]">
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

                    <div className="overflow-x-auto">
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
                                    const isPrePicked = prePickedSkus.has(summary.sku);
                                    return (
                                        <TableRow
                                            key={summary.sku}
                                            className={cn(
                                                "cursor-pointer",
                                                isPrePicked && 'bg-green-100/50 dark:bg-green-900/20 opacity-60 hover:opacity-100 hover:bg-green-100/80'
                                            )}
                                            onClick={() => summary.details && setSelectedProduct(summary.details)}
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={isPrePicked}
                                                    onCheckedChange={() => handlePrePickToggle(summary.sku)}
                                                    className="h-6 w-6"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Image
                                                    src={summary.details?.productDetails?.imageUrl?.[0]?.url || 'https://placehold.co/100x100.png'}
                                                    alt={summary.name}
                                                    width={60}
                                                    height={60}
                                                    className="rounded-md border object-cover"
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {summary.name}
                                                <p className="text-xs text-muted-foreground">SKU: {summary.sku}</p>
                                            </TableCell>
                                            <TableCell>{summary.location}</TableCell>
                                            <TableCell className="text-right font-bold text-lg">{summary.total}</TableCell>
                                            <TableCell className="text-right">{summary.orders.size}</TableCell>
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
                </CardContent>
            </Card>
        </main>
    );
}

    