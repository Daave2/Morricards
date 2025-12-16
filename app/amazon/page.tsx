
import { Suspense } from 'react';
import AmazonClient from './AmazonClient';
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

// This page handles the base /amazon route.
export default function AmazonPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AmazonClient />
    </Suspense>
  );
}
