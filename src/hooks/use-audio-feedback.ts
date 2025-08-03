'use client';

import { useCallback, useRef } from 'react';

type SoundType = 'success' | 'error' | 'info';

export function useAudioFeedback() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playSound = useCallback((type: SoundType) => {
    // Lazily create AudioContext on first user interaction
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.error("Web Audio API is not supported in this browser.");
        return;
      }
    }
    
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    // The AudioContext may be in a suspended state initially in some browsers.
    // It must be resumed by a user gesture, which opening the scanner is.
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);

    switch (type) {
      case 'success':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.05);
        break;
      case 'error':
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
        break;
      case 'info':
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        break;
    }

    oscillator.start(audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.1);
    oscillator.stop(audioContext.currentTime + 0.1);
  }, []);

  const playSuccess = useCallback(() => playSound('success'), [playSound]);
  const playError = useCallback(() => playSound('error'), [playSound]);
  const playInfo = useCallback(() => playSound('info'), [playSound]);

  return { playSuccess, playError, playInfo };
}
