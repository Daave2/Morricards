
import { Suspense } from 'react';
import LockerClient from './LockerClient';
import { Loader2 } from 'lucide-react';

function Loading() {
    return (
        <div className="flex justify-center items-center h-screen">
            <div className="text-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading Locker...</p>
            </div>
        </div>
    )
}

export default function LockerPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LockerClient />
    </Suspense>
  );
}
