
import { Suspense } from 'react';
import PickingListClient from '@/components/PickingListClient';

function PickingListFallback() {
  return (
    <div className="p-8 text-center">
      <p>Loading Picking List...</p>
    </div>
  )
}

export default function PickingPage() {
  return (
    <>
      <Suspense fallback={<PickingListFallback />}>
        <PickingListClient />
      </Suspense>
    </>
  );
}
