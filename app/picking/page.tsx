
'use client';

import React, { Suspense } from 'react';
import PickingListClient from '@/components/PickingListClient';
import AppHeader from '@/components/AppHeader';


export default function PickingPage() {
  return (
    <>
      <AppHeader title="Picking List" />
      <Suspense fallback={<div>Loading...</div>}>
        <PickingListClient />
      </Suspense>
    </>
  );
}
