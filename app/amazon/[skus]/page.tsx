
import { Suspense } from 'react';
import AmazonClient from '../AmazonClient';
import { Loader2 } from 'lucide-react';

function Loading() {
    return (
        <div className="flex justify-center items-center h-screen">
            <div className="text-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading Amazon Assistant...</p>
            </div>
        </div>
    )
}

type AmazonSkuPageProps = {
    params: { skus?: string };
    searchParams: { [key: string]: string | string[] | undefined };
}

// This page handles a dynamic route segment for SKUs.
// e.g., /amazon/12345,67890
export default function AmazonSkuPage({ params, searchParams }: AmazonSkuPageProps) {
  // The `skus` param is a string from the URL, which might be comma-separated.
  const skuString = params.skus ? decodeURIComponent(params.skus) : undefined;
  
  // Split the string by commas, trim whitespace, and filter out any empty strings.
  const initialSkus = skuString ? skuString.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  
  const locationId = typeof searchParams.locationId === 'string' ? searchParams.locationId : undefined;

  return (
    <Suspense fallback={<Loading />}>
      <AmazonClient initialSkus={initialSkus} locationIdFromUrl={locationId} />
    </Suspense>
  );
}
