
'use client';

import { useState, useEffect, useCallback } from 'react';
import { openDB } from 'idb';

const LOCAL_STORAGE_KEY_SETTINGS = 'morricards-api-settings';
const LOCAL_STORAGE_KEY_PRODUCTS = 'morricards-products';
const LOCAL_STORAGE_KEY_AVAILABILITY = 'morricards-availability-report';
const DB_NAME = 'smu';

export interface ApiSettings {
  bearerToken: string;
  debugMode: boolean;
}

export const DEFAULT_SETTINGS: ApiSettings = {
  bearerToken: 'hTP4yVbB0OzMevXY5HIsiO68PvAw',
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

  // Return default settings on server or before mount, and real settings after mount
  return { 
    settings: isMounted ? settings : DEFAULT_SETTINGS, 
    setSettings: updateSettings,
    clearAllData
  };
}
