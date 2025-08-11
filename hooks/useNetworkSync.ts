
'use client';
import { useEffect, useState } from 'react';
import { flushQueue } from '@/lib/offlineQueue';
import { useToast } from './use-toast';

export function useNetworkSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Set initial online state
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        setIsOnline(navigator.onLine);
    }
  },[])

  useEffect(() => {
    async function trySync() {
      if(!navigator.onLine) {
        setIsOnline(false);
        return;
      };

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
    
    const handleOnline = () => {
        setIsOnline(true);
        toast({ title: 'Back Online', description: 'Attempting to sync offline data...' });
        trySync();
    };

    const handleOffline = () => {
        setIsOnline(false);
    }
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Attempt on mount too
    trySync();

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    }
  }, [toast]);

  return { lastSync, isOnline };
}
