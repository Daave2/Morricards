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

// Correctly typed props for an optional catch-all route
type AmazonSharePageProps = {
  params: { share?: string[] };
  searchParams: { [key: string]: string | string[] | undefined };
};


export default function AmazonSharePage({ params, searchParams }: AmazonSharePageProps) {
  // The `share` param is an array of segments. We expect at most one segment for our use case.
  const skuString = params.share?.[0] ? decodeURIComponent(params.share[0]) : undefined;
  
  // Split the string by commas, trim whitespace, and filter out any empty strings.
  const initialSkus = skuString ? skuString.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  
  const locationId = typeof searchParams.locationId === 'string' ? searchParams.locationId : undefined;

  return (
    <Suspense fallback={<Loading />}>
      <AmazonClient initialSkus={initialSkus} locationIdFromUrl={locationId} />
    </Suspense>
  );
}
