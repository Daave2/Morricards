
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Result, DecodeHintType } from '@zxing/library';

type Props = {
  onResult?: (text: string, raw?: Result) => void;
  onError?: (message: string) => void;
  scanDelayMs?: number;
};

const ZXingScanner = forwardRef<{ start: () => void }, Props>(({
  onResult,
  onError,
  scanDelayMs = 500,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef(true);

  const hints = useMemo(() => {
    const h = new Map();
    h.set(DecodeHintType.TRY_HARDER, true);
    return h;
  }, []);
  
  const stopScan = useCallback(() => {
    if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
  }, []);

  const startScan = useCallback(async () => {
    if (!videoRef.current) return;
    
    stopScan();
    isScanningRef.current = true;

    try {
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader(hints, scanDelayMs);
      }
      
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);

      if (!videoRef.current) {
          stopScan();
          return;
      }
      
      videoRef.current.srcObject = streamRef.current;
      // The play() method returns a Promise which can be interrupted.
      // We catch and ignore the interruption error.
      try {
        await videoRef.current.play();
      } catch (playError) {
        if ((playError as Error).name !== 'AbortError') {
          console.error('Video play error:', playError);
        }
      }


      controlsRef.current = await readerRef.current.decodeFromVideoElement(
        videoRef.current,
        (result, err) => {
          if (result && isScanningRef.current) {
            isScanningRef.current = false;
            // No need to call stopScan() here, as the parent component will re-open it.
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
      stopScan();
    }
  }, [hints, onResult, onError, scanDelayMs, stopScan]);

  useImperativeHandle(ref, () => ({
    start: startScan
  }));
  
  useEffect(() => {
    startScan();
    return () => {
      stopScan();
    };
  }, [startScan, stopScan]);

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
});

ZXingScanner.displayName = 'ZXingScanner';

export default ZXingScanner;
