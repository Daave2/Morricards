

'use client';
import { useEffect, useState, useCallback } from 'react';
import { flushAvailabilityQueue, flushProductQueue, type SyncedProduct } from '@/lib/offlineQueue';
import { useToast } from './use-toast';
import { getProductData } from '@/app/actions';
import { useApiSettings } from './use-api-settings';

export function useNetworkSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncedItems, setSyncedItems] = useState<SyncedProduct[]>([]);
  const { toast } = useToast();
  const { settings } = useApiSettings();

  useEffect(() => {
    // Set initial online state
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        setIsOnline(navigator.onLine);
    }
  },[])

  const trySync = useCallback(async () => {
    if(!navigator.onLine) {
      setIsOnline(false);
      return;
    };

    let totalSynced = 0;

    try { 
      // Sync availability reports
      const { synced: availSynced } = await flushAvailabilityQueue();
      if (availSynced > 0) {
        totalSynced += availSynced;
        toast({
            title: 'Sync Complete',
            description: `${availSynced} offline availability report(s) have been synced.`,
        });
      }

      // Sync queued products
      const { products: fetchedProducts, syncedCount: productsSynced } = await flushProductQueue({
          bearerToken: settings.bearerToken,
          debugMode: settings.debugMode,
      });

      if (productsSynced > 0) {
          totalSynced += productsSynced;
          setSyncedItems(fetchedProducts);
          toast({
              title: 'Sync Complete',
              description: `${productsSynced} offline product(s) have been synced.`,
          });
      }

      if (totalSynced > 0) {
        setLastSync(Date.now());
      }
    } catch (e) {
      console.error("Sync failed:", e);
      toast({
        title: "Sync Failed",
        description: "Could not sync some offline data. It will be retried later.",
        variant: "destructive",
      })
    }
  }, [toast, settings.bearerToken, settings.debugMode]);
  
  useEffect(() => {
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
  }, [toast, trySync]);

  return { lastSync, isOnline, syncedItems };
}
