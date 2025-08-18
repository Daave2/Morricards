
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { BrowserMultiFormatReader, IScannerControls, type IBrowserCodeReaderOptions } from '@zxing/browser';
import { Result, DecodeHintType } from '@zxing/library';
import { Button } from './ui/button';
import { Camera, Loader2, ScanSearch } from 'lucide-react';

type Props = {
  onResult?: (text: string, raw?: Result) => void;
  onError?: (message: string) => void;
  scanDelayMs?: number;
};

const ZXingScanner = forwardRef<{ start: () => void; stop: () => void; getOcrDataUri: () => string | null }, Props>(({
  onResult,
  onError,
  scanDelayMs = 500,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

    try {
      if (!readerRef.current) {
        const options: IBrowserCodeReaderOptions = {
          delayBetweenScanAttempts: scanDelayMs,
        };
        readerRef.current = new BrowserMultiFormatReader(hints, options);
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
      
      try {
        await videoRef.current.play();
      } catch (playError) {
        if ((playError as Error).name !== 'AbortError') {
          console.error('Video play error:', playError);
        }
      }

      let isScanning = true;

      const decodeCallback = (result: Result | undefined, err: any) => {
        if (result && isScanning) {
          isScanning = false;
          onResult?.(result.getText(), result);
          controlsRef.current?.stop();
        }
        if (err && !(err.name === 'NotFoundException')) {
           onError?.(err.message);
        }
      };

      controlsRef.current = await readerRef.current.decodeFromVideoElement(videoRef.current, decodeCallback);

    } catch (e: any) {
      console.error("Scanner start error:", e);
      onError?.(e?.message || String(e));
      stopScan();
    }
  }, [hints, onResult, onError, scanDelayMs, stopScan]);
  
  const getOcrDataUri = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    if(context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUri = canvas.toDataURL('image/jpeg', 0.9);
      return dataUri;
    }
    return null;
  }, []);

  useImperativeHandle(ref, () => ({
    start: startScan,
    stop: stopScan,
    getOcrDataUri: getOcrDataUri,
  }));
  
  useEffect(() => {
    return () => {
      stopScan();
    };
  }, [stopScan]);

  return (
      <div className="relative w-full aspect-video rounded-lg overflow-hidden border">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />
        <div aria-hidden className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="w-2/3 aspect-square border-4 border-white/80 rounded-lg" />
        </div>
      </div>
  );
});

ZXingScanner.displayName = 'ZXingScanner';

export default ZXingScanner;
