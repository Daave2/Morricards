
'use client';

import { useEffect, useState, useCallback } from 'react';

const LOCAL_STORAGE_KEY_CUSTOM_BG = 'morricards-custom-background';
const STYLE_ID = 'custom-background-style';

export function useCustomTheme() {
  const [hasCustomBackground, setHasCustomBackground] = useState(false);

  const applyBackground = useCallback((dataUrl: string | null) => {
    let styleTag = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

    if (!dataUrl) {
      if (styleTag) {
        styleTag.remove();
      }
      return;
    }

    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = STYLE_ID;
      document.head.appendChild(styleTag);
    }
    
    // Use a more specific selector to ensure it overrides the default
    const css = `
      html.theme-glass body {
        background-image: url(${dataUrl}) !important;
      }
    `;
    styleTag.innerHTML = css;
  }, []);

  useEffect(() => {
    try {
      const savedBg = window.localStorage.getItem(LOCAL_STORAGE_KEY_CUSTOM_BG);
      if (savedBg) {
        setHasCustomBackground(true);
        applyBackground(savedBg);
      }
    } catch (e) {
        console.error('Could not access local storage for custom theme.', e);
    }
  }, [applyBackground]);
  
  const setCustomBackground = useCallback((dataUrl: string) => {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY_CUSTOM_BG, dataUrl);
      setHasCustomBackground(true);
      applyBackground(dataUrl);
    } catch (e) {
       console.error('Could not save custom background to local storage.', e);
    }
  }, [applyBackground]);

  const removeCustomBackground = useCallback(() => {
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY_CUSTOM_BG);
      setHasCustomBackground(false);
      applyBackground(null);
    } catch (e) {
      console.error('Could not remove custom background from local storage.', e);
    }
  }, [applyBackground]);

  return { hasCustomBackground, setCustomBackground, removeCustomBackground };
}
