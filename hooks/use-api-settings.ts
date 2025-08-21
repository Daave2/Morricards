
'use client';

import { useState, useEffect, useCallback } from 'react';
import { openDB } from 'idb';
import { toast } from './use-toast';

const LOCAL_STORAGE_KEY_SETTINGS = 'morricards-api-settings';
const LOCAL_STORAGE_KEY_PRODUCTS = 'morricards-products';
const LOCAL_STORAGE_KEY_AVAILABILITY = 'morricards-availability-report';
const LOCAL_STORAGE_KEY_CUSTOM_BG = 'morricards-custom-background';
const DB_NAME = 'smu';

export interface ApiSettings {
  bearerToken: string;
  debugMode: boolean;
}

export const DEFAULT_SETTINGS: ApiSettings = {
  bearerToken: 'vAllJuJxckLtjMANPmS1Lps9btvF',
  debugMode: false,
};

export function useApiSettings() {
  const [settings, setSettings] = useState<ApiSettings>(DEFAULT_SETTINGS);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const item = window.localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS);
      if (item) {
        const parsed = JSON.parse(item);
        setSettings(prev => ({...prev, ...parsed}));
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
        try {
            const currentSettings = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS) || '{}');
            const newSettings = {...currentSettings, ...settings};
            window.localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
        } catch (error) {
            console.error("Failed to save settings to localStorage", error);
        }
    }
  }, [settings, isMounted]);
  
  const updateSettings = (newSettings: Partial<ApiSettings>) => {
    setSettings(prev => ({...prev, ...newSettings}));
  }

  const clearAllData = useCallback(() => {
    try {
      // Clear local storage items
      window.localStorage.removeItem(LOCAL_STORAGE_KEY_PRODUCTS);
      window.localStorage.removeItem(LOCAL_STORAGE_KEY_AVAILABILITY);
      window.localStorage.removeItem(LOCAL_STORAGE_KEY_CUSTOM_BG);


      // Clear IndexedDB stores
      const clearDB = async () => {
        const db = await openDB(DB_NAME);
        if (db.objectStoreNames.contains('availability-captures')) {
          await db.clear('availability-captures');
        }
        if (db.objectStoreNames.contains('product-fetches')) {
           await db.clear('product-fetches');
        }
        db.close();
      }
      clearDB();
      
      // Optionally, reset settings to default here as well or keep them.
      // Let's keep them for now, as user might just want to clear data, not settings.

    } catch (error) {
       console.error("Failed to clear application data", error);
    }
  }, []);

  const fetchAndUpdateToken = useCallback(async () => {
    const tokenUrl = 'https://gist.githubusercontent.com/Daave2/b62faeed0dd435100773d4de775ff52d/raw/5c7d6426cb1406f0cae7d1f3d90f6bd497533943/gistfile1.txt';
    toast({ title: 'Fetching latest token...' });
    try {
      const response = await fetch(tokenUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch token: ${response.statusText}`);
      }
      const token = await response.text();
      const trimmedToken = token.trim();

      if (!trimmedToken) {
          throw new Error('Fetched token is empty.');
      }

      setSettings(prev => ({ ...prev, bearerToken: trimmedToken }));
      toast({
        title: 'Token Updated',
        description: 'The latest bearer token has been fetched and saved.',
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({
        variant: 'destructive',
        title: 'Fetch Failed',
        description: `Could not fetch the token. ${errorMessage}`,
      });
      console.error(error);
    }
  }, [setSettings]);

  return { 
    settings: isMounted ? settings : DEFAULT_SETTINGS, 
    setSettings: updateSettings,
    clearAllData,
    fetchAndUpdateToken
  };
}
