import { Suspense } from 'react';
import AssistantPageClient from '../AssistantPageClient';
import { Loader2 } from 'lucide-react';

function Loading() {
    return (
        <div className="flex justify-center items-center h-screen">
            <div className="text-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading Assistant...</p>
            </div>
        </div>
    )
}

// Define a specific, local type for the page's props, avoiding the generic PageProps from Next.js.
type AssistantRouteProps = {
  params: {
    sku?: string[];
  };
};

// This is now a Server Component. It extracts the SKU and passes it to the Client Component.
export default function AssistantPage({ params }: AssistantRouteProps) {
  const skuFromPath = Array.isArray(params.sku) ? params.sku[0] : undefined;

  return (
    <Suspense fallback={<Loading />}>
      <AssistantPageClient skuFromPath={skuFromPath} />
    </Suspense>
  );
}
