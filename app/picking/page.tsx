
import { Suspense } from 'react';
import PickingListClient from '@/components/PickingListClient';
import { Skeleton } from '@/components/ui/skeleton';


const LoadingFallback = () => {
    return (
        <div className="container mx-auto px-4 py-8 md:py-12">
            <div className="max-w-4xl mx-auto mb-12">
                <Skeleton className="h-48 w-full" />
            </div>
            <div className="mb-8 p-4">
                 <Skeleton className="h-24 w-full" />
            </div>
             <div className="gap-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        </div>
    )
}

export default function PickingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PickingListClient />
    </Suspense>
  );
}
