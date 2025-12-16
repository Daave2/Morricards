
'use client';

import React, { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/src/firebase';
import { useApiSettings } from '@/hooks/use-api-settings';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface OrderProduct {
    sku: string;
    name: string;
    quantity: number;
    details?: {
        location: {
            standard?: string;
        };
    } | null;
}

interface Order {
    id: string;
    collectionSlot: string;
    products: OrderProduct[];
}

interface ProductSummary {
    name: string;
    location: string;
    total: number;
    orders: Set<string>;
}

export default function DailyReportClient({ date }: { date: string }) {
    const { settings } = useApiSettings();
    const firestore = useFirestore();

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
                        name: product.name,
                        location: product.details?.location.standard || 'N/A',
                        total: 0,
                        orders: new Set<string>(),
                    };
                }
                summary[product.sku].total += product.quantity;
                summary[product.sku].orders.add(order.id);
            });
        });

        return summary;
    }, [allOrders, date]);

    const sortedProducts = useMemo(() => {
        return Object.entries(productSummary).sort(([, a], [, b]) => b.total - a.total);
    }, [productSummary]);

    const handleExportCSV = () => {
        const csvHeader = "Name,SKU,Location,TotalOrdered,OrderCount\n";
        const csvRows = sortedProducts.map(([sku, summary]) => {
            const row = [
                `"${summary.name.replace(/"/g, '""')}"`,
                sku,
                `"${summary.location.replace(/"/g, '""')}"`,
                summary.total,
                summary.orders.size
            ];
            return row.join(',');
        });

        const csvContent = csvHeader + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-s8;' });
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
                                    <TableHead>Product Name</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead className="text-right">Total Ordered</TableHead>
                                    <TableHead className="text-right">In # Orders</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedProducts.length > 0 ? sortedProducts.map(([sku, summary]) => (
                                    <TableRow key={sku}>
                                        <TableCell className="font-medium">{summary.name}</TableCell>
                                        <TableCell>{sku}</TableCell>
                                        <TableCell>{summary.location}</TableCell>
                                        <TableCell className="text-right font-bold text-lg">{summary.total}</TableCell>
                                        <TableCell className="text-right">{summary.orders.size}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
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

