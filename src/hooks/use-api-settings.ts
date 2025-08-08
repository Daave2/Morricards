'use client';

import { useState, useEffect } from 'react';

const LOCAL_STORAGE_KEY_SETTINGS = 'morricards-api-settings';

export interface ApiSettings {
  bearerToken: string;
}

export const DEFAULT_SETTINGS: ApiSettings = {
  bearerToken: 'l5rXP77Vno9GxqP0RA8351v5iJt8',
};

export function useApiSettings() {
  const [settings, setSettings] = useState<ApiSettings>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_SETTINGS;
    }
    try {
      const item = window.localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS);
      return item ? JSON.parse(item) : DEFAULT_SETTINGS;
    } catch (error) {
      console.error(error);
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error(error);
    }
  }, [settings]);
  
  const updateSettings = (newSettings: Partial<ApiSettings>) => {
    setSettings(prev => ({...prev, ...newSettings}));
  }

  return { settings, setSettings: updateSettings };
}
