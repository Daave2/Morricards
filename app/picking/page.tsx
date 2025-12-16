

import { Suspense } from 'react';
import PickingListClient from './PickingListClient';
import { Loader2 } from 'lucide-react';

function Loading() {
    return (
        <div className="flex justify-center items-center h-screen">
            <div className="text-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading Picker...</p>
            </div>
        </div>
    )
}

export default function PickingPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PickingListClient />
    </Suspense>
  );
}

