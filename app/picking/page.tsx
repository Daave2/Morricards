
import { Suspense } from 'react';
import PickingListClient from '@/components/PickingListClient';
import AppHeader from '@/components/AppHeader';

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
      <AppHeader title="Picking List" />
      <Suspense fallback={<PickingListFallback />}>
        <PickingListClient />
      </Suspense>
    </>
  );
}
