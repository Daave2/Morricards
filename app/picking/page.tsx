
import { Suspense } from 'react';
import PickingListClient from '@/components/PickingListClient';
import InstallPrompt from '@/components/InstallPrompt';

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
      <InstallPrompt />
      <Suspense fallback={<PickingListFallback />}>
        <PickingListClient />
      </Suspense>
    </>
  );
}

    