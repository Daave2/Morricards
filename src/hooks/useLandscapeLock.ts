'use client';
import { useEffect } from 'react';

export function useLandscapeLock() {
  useEffect(() => {
    const lock = async () => {
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
        }
      } catch(e) {
          console.warn("Could not lock screen orientation:", e);
      }
    };
    lock();
  }, []);
}
