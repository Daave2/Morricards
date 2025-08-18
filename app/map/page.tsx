
import { Suspense } from 'react';
import MapPageClient from '@/components/MapPageClient';
import AppHeader from '@/components/AppHeader';

export default function MapPage() {
  return (
    <>
      <AppHeader title="Precise Store Map" />
      <Suspense fallback={<div className="p-4 text-center">Loading Map...</div>}>
        <MapPageClient />
      </Suspense>
    </>
  );
}
