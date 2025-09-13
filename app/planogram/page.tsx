
import { Suspense } from 'react';
import PlanogramClient from './PlanogramClient';
import { Loader2 } from 'lucide-react';

function Loading() {
    return (
        <div className="flex justify-center items-center h-screen">
            <div className="text-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading Validator...</p>
            </div>
        </div>
    )
}

export default function PlanogramPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PlanogramClient />
    </Suspense>
  );
}
