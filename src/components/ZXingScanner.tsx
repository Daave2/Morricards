
'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Result, DecodeHintType } from '@zxing/library';

type Props = {
  onResult?: (text: string, raw?: Result) => void;
  onError?: (message: string) => void;
  scanDelayMs?: number;
};

export default function ZXingScanner({
  onResult,
  onError,
  scanDelayMs = 500, // Slower scan helps with performance and battery
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  // We don't need all the extra state from the example, just the essentials
  // to make the scanner work in the app context.

  const hints = useMemo(() => {
    const h = new Map();
    // We remove the BarcodeFormat hint to avoid the build error.
    // The reader will default to scanning all supported formats.
    h.set(DecodeHintType.TRY_HARDER, true);
    return h;
  }, []);
  
  const stopScan = useCallback(() => {
    if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
    }
  }, []);

  const startScan = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader(hints, scanDelayMs);
      }
      
      // Stop any previous session before starting a new one
      stopScan();
      
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      controlsRef.current = await readerRef.current.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result, err) => {
          if (result) {
            // Once we have a result, stop the scan and notify the parent.
            stopScan();
            onResult?.(result.getText(), result);
          }
          if (err && !(err.name === 'NotFoundException')) {
             onError?.(err.message);
          }
        }
      );
    } catch (e: any) {
      console.error("Scanner start error:", e);
      onError?.(e?.message || String(e));
    }
  }, [hints, onResult, onError, scanDelayMs, stopScan]);

  useEffect(() => {
    startScan();
    
    // Cleanup function to stop the scanner when the component unmounts
    return () => {
      stopScan();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount and unmount

  return (
      <div className="relative w-full aspect-video rounded-lg overflow-hidden border">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          autoPlay
        />
        <div aria-hidden className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="w-2/3 aspect-square border-4 border-white/80 rounded-lg" />
        </div>
      </div>
  );
}
