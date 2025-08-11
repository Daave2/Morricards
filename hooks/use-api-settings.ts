
'use client';

import { useState, useEffect } from 'react';

const LOCAL_STORAGE_KEY_SETTINGS = 'morricards-api-settings';

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

  // Return default settings on server or before mount, and real settings after mount
  return { settings: isMounted ? settings : DEFAULT_SETTINGS, setSettings: updateSettings };
}
