
'use client';

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import PickingListClient from '@/components/PickingListClient';
import AppHeader from '@/components/AppHeader';


function PickingPage() {
  return (
    <>
      <AppHeader title="Picking List" />
      <Suspense>
        <PickingListClient />
      </Suspense>
    </>
  );
}


export default function Home() {
  redirect('/picking');
}
