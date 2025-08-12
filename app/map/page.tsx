
import { Suspense } from 'react';
import MapPageClient from '@/components/MapPageClient';

export default function MapPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center">Loading Map...</div>}>
      <MapPageClient />
    </Suspense>
  );
}
