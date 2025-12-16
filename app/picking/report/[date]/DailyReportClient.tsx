
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/src/firebase';
import { useApiSettings } from '@/hooks/use-api-settings';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import ProductCard from '@/components/product-card';
import type { FetchMorrisonsDataOutput } from '@/lib/morrisons-api';
import { cn } from '@/lib/utils';

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

    const sortedProducts = useMemo(() => {
        return Object.values(productSummary).sort((a, b) => {
             const aIsPrePicked = prePickedSkus.has(a.sku);
             const bIsPrePicked = prePickedSkus.has(b.sku);

             if (aIsPrePicked && !bIsPrePicked) return 1;
             if (!aIsPrePicked && bIsPrePicked) return -1;
            
            return b.total - a.total;
        });
    }, [productSummary, prePickedSkus]);

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
        const csvRows = sortedProducts.map((summary) => {
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
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle>Daily Order Report</CardTitle>
                        <CardDescription>Aggregated product list for {date}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleExportCSV} disabled={sortedProducts.length === 0}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                        <Button asChild variant="secondary">
                           <Link href="/picking">Back to Picking</Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
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
                                {sortedProducts.length > 0 ? sortedProducts.map((summary) => {
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
                                            No orders found for this date.
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
