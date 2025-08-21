
import { Suspense } from 'react';
import AssistantPageClient from '@/components/assistant/page';
import { Skeleton } from '@/components/ui/skeleton';

const LoadingFallback = () => {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-2xl mx-auto mb-8">
            <Skeleton className="h-48 w-full" />
        </div>
        <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-4">
                <Skeleton className="h-8 w-48" />
            </h2>
            <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        </div>
    </div>
  )
}


export default function AssistantPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AssistantPageClient />
    </Suspense>
  );
}
