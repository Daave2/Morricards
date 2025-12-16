
import { Suspense } from 'react';
import AssistantPageClient from "./AssistantPageClient";
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

// This page now wraps the client component in a Suspense boundary
// to handle the use of `useSearchParams` within it.
export default function AssistantPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AssistantPageClient />
    </Suspense>
  );
}
