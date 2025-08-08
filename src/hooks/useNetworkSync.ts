'use client';
import { useEffect, useState } from 'react';
import { flushQueue } from '@/lib/offlineQueue';
import { useToast } from './use-toast';

export function useNetworkSync() {
  const [lastSync, setLastSync] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function trySync() {
      try { 
        const { synced } = await flushQueue(); 
        if (synced > 0) {
            setLastSync(Date.now());
            toast({
                title: 'Sync Complete',
                description: `${synced} offline item(s) have been synced.`,
            });
        }
      } catch (e) {
        console.error("Sync failed:", e);
      }
    }
    
    const onOnline = () => {
        toast({ title: 'Back Online', description: 'Attempting to sync offline data...' });
        trySync();
    };
    
    window.addEventListener('online', onOnline);

    // Attempt on mount too
    if(navigator.onLine) {
        trySync();
    }

    return () => window.removeEventListener('online', onOnline);
  }, [toast]);

  return { lastSync };
}
