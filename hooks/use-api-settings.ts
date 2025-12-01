
'use client';

import { useState, useEffect, useCallback } from 'react';
import { openDB } from 'idb';
import { toast } from './use-toast';

const LOCAL_STORAGE_KEY_SETTINGS = 'morricards-api-settings';
const LOCAL_STORAGE_KEY_PRODUCTS = 'morricards-products';
const LOCAL_STORAGE_KEY_AVAILABILITY = 'morricards-availability-report';
const LOCAL_STORAGE_KEY_CUSTOM_BG = 'morricards-custom-background';
const LOCAL_STORAGE_KEY_RECENT_AI = 'morricards-assistant-recent';
const LOCAL_STORAGE_KEY_MISSING_HISTORY = 'morricards-planogram-missing-history';
const DB_NAME = 'smu';

export interface ApiSettings {
  bearerToken: string;
  debugMode: boolean;
  locationId: string;
  chatWebhookUrl: string;
}

export const DEFAULT_SETTINGS: ApiSettings = {
  bearerToken: 'vAllJuJxckLtjMANPmS1Lps9btvF',
  debugMode: false,
  locationId: '218',
  chatWebhookUrl: '',
};

export function useApiSettings() {
  const [settings, setSettings] = useState<ApiSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const fetchAndUpdateToken = useCallback(async () => {
    const tokenUrl = 'https://gist.githubusercontent.com/Daave2/b62faeed0dd435100773d4de775ff52d/raw/';
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

      // Use setSettings to update state and localStorage
      setSettings(prev => {
        const newSettings = { ...prev, bearerToken: trimmedToken };
        window.localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
        return newSettings;
      });

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
  }, []);

  useEffect(() => {
    let currentSettings: ApiSettings = DEFAULT_SETTINGS;
    try {
      const item = window.localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS);
      if (item) {
        currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(item) };
        setSettings(currentSettings);
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
    } finally {
        setSettingsLoaded(true);
    }

    // If the stored token is the same as the default one, it's likely the first run or has never been updated.
    if (currentSettings.bearerToken === DEFAULT_SETTINGS.bearerToken) {
      fetchAndUpdateToken();
    }
  }, [fetchAndUpdateToken]);

  const updateSettings = useCallback((newSettings: Partial<ApiSettings>) => {
    setSettings(prev => {
        const updated = {...prev, ...newSettings};
        try {
            window.localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(updated));
        } catch (error) {
            console.error("Failed to save settings to localStorage", error);
        }
        return updated;
    });
  }, []);
  
  const clearAllData = useCallback(() => {
    try {
      // Clear local storage items
      window.localStorage.removeItem(LOCAL_STORAGE_KEY_PRODUCTS);
      window.localStorage.removeItem(LOCAL_STORAGE_KEY_AVAILABILITY);
      window.localStorage.removeItem(LOCAL_STORAGE_KEY_CUSTOM_BG);
      window.localStorage.removeItem(LOCAL_STORAGE_KEY_RECENT_AI);
      window.localStorage.removeItem(LOCAL_STORAGE_KEY_MISSING_HISTORY);


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

  return { 
    settings: settingsLoaded ? settings : DEFAULT_SETTINGS, 
    setSettings: updateSettings,
    clearAllData,
    fetchAndUpdateToken,
    settingsLoaded,
  };
}
