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
  scanDelayMs = 500,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  
  // This ref will hold the MediaStream object to ensure we can clean it up properly.
  const streamRef = useRef<MediaStream | null>(null);

  const hints = useMemo(() => {
    const h = new Map();
    h.set(DecodeHintType.TRY_HARDER, true);
    return h;
  }, []);
  
  const stopScan = useCallback(() => {
    // Stop the ZXing decoder controls
    if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
    }
    // Manually stop all tracks on the stream
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
  }, []);

  const startScan = useCallback(async () => {
    if (!videoRef.current) return;
    
    stopScan(); // Ensure any previous streams are stopped before starting a new one.

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

      // Get the media stream ourselves.
      streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);

      if (!videoRef.current) {
          stopScan();
          return;
      }
      
      // Assign the stream to the video element.
      videoRef.current.srcObject = streamRef.current;

      // Start decoding from the video element.
      controlsRef.current = await readerRef.current.decodeFromVideoElement(
        videoRef.current,
        (result, err) => {
          if (result) {
            // Once we have a result, stop the scan immediately to prevent rapid re-scans
            // and call the onResult callback.
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
      stopScan(); // Clean up on error.
    }
  }, [hints, onResult, onError, scanDelayMs, stopScan]);

  useEffect(() => {
    startScan();
    
    // The returned function from useEffect is the cleanup function.
    // This will be called when the component unmounts.
    return () => {
      stopScan();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount and unmount.

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
