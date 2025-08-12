
'use client';

import React, { Suspense } from 'react';
import PickingListClient from '@/components/PickingListClient';


export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PickingListClient />
    </Suspense>
  );
}
