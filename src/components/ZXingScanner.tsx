// components/ZXingScanner.tsx  (or app/components/ZXingScanner.tsx)
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, Result } from '@zxing/library';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { CameraOff, Upload } from 'lucide-react';
import { Slider } from './ui/slider';

type Props = {
  onResult?: (text: string, raw: Result) => void;
  onError?: (message: string) => void;
  scanDelayMs?: number;
  className?: string;
};

export default function ZXingScanner({
  onResult,
  onError,
  scanDelayMs = 500,
  className
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamTrackRef = useRef<MediaStreamTrack | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setInternalError] = useState<string | null>(null);

  // torch / zoom
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const [zoomMin, setZoomMin] = useState<number>(1);
  const [zoomMax, setZoomMax] = useState<number>(1);

  // decode hints: restrict to 2D formats; add 1D if needed
  const hints = useMemo(() => {
    const h = new Map();
    const formats = [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.PDF_417,
      BarcodeFormat.AZTEC,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_128,
      BarcodeFormat.ITF
    ];
    h.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    h.set(DecodeHintType.TRY_HARDER, true);
    return h;
  }, []);

  const handleError = useCallback((e: any) => {
      const message = e?.message || String(e);
      setInternalError(message);
      onError?.(message);
  }, [onError]);

  const ensureReader = useCallback(() => {
    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader(hints, scanDelayMs);
    }
    return readerRef.current!;
  }, [hints, scanDelayMs]);

  const pickDefaultDeviceId = useCallback((list: MediaDeviceInfo[]) => {
    const back = list.find(d => /back|rear|environment/i.test(d.label || ''));
    return (back || list[list.length - 1])?.deviceId ?? null;
  }, []);

  const stop = useCallback(async () => {
    try { 
        if (controlsRef.current) {
            controlsRef.current.stop();
            controlsRef.current = null;
        }
        if (readerRef.current) {
            readerRef.current.reset();
        }
    } catch (e) {
      // no-op
    }
    streamTrackRef.current = null;
    setRunning(false);
    setTorchOn(false);
  }, []);

  const start = useCallback(async (id?: string | null) => {
    if (!videoRef.current) return;
    setInternalError(null);
    try {
      const codeReader = ensureReader();
      await stop(); // stop any previous session
      
      const selectedId = id ?? deviceId;
      if (!selectedId) {
          throw new Error("No camera device selected.");
      }

      setRunning(true);
      const newControls = await codeReader.decodeFromVideoDevice(
          selectedId,
          videoRef.current,
          (result, err) => {
            if (result) {
              onResult?.(result.getText(), result);
            }
            if (err && !err.message.includes('No QR code found')) {
              handleError(err);
            }
          }
      );
      controlsRef.current = newControls;

      const stream = videoRef.current.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks?.()[0] ?? null;
      streamTrackRef.current = track;

      if (track && typeof track.getCapabilities === 'function') {
        const caps: any = track.getCapabilities();
        setTorchSupported(!!caps.torch);
        if (caps.zoom) {
          setZoomSupported(true);
          setZoomMin(caps.zoom.min ?? 1);
          setZoomMax(caps.zoom.max ?? 1);
          setZoom(caps.zoom.min ?? 1);
        } else {
          setZoomSupported(false);
        }
      }
    } catch (e: any) {
      setRunning(false);
      handleError(e);
    }
  }, [deviceId, ensureReader, onResult, stop, handleError]);



  const loadDevices = useCallback(async () => {
    setInternalError(null);
    try {
      if (!navigator.mediaDevices) {
        throw new Error("MediaDevices API not available.");
      }
      await navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch((err) => { throw err });
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      setCameras(devices);
      if (!deviceId && devices.length > 0) {
        const defaultId = pickDefaultDeviceId(devices);
        setDeviceId(defaultId);
        await start(defaultId);
      } else if (devices.length > 0 && deviceId) {
        await start(deviceId);
      } else {
        throw new Error("No video input devices found.");
      }
    } catch (e: any) {
      handleError(e);
    }
  }, [deviceId, pickDefaultDeviceId, handleError, start]);

  useEffect(() => {
    loadDevices();
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const toggleTorch = useCallback(async () => {
    const track = streamTrackRef.current;
    if (!track) return;
    try {
      const newVal = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: newVal }] as any });
      setTorchOn(newVal);
    } catch (e: any) {
      handleError(e);
    }
  }, [torchOn, handleError]);

  const changeZoom = useCallback(async (val: number) => {
    const track = streamTrackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: val }] as any });
      setZoom(val);
    } catch (e: any) {
      handleError(e);
    }
  }, [handleError]);


  const onPickImage = async (file: File) => {
    setInternalError(null);
    try {
      const url = URL.createObjectURL(file);
      const codeReader = ensureReader();
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
      const result = await codeReader.decodeFromImageElement(img);
      onResult?.(result.getText(), result);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      handleError(e);
    }
  };

  const handleCameraChange = (newDeviceId: string) => {
      setDeviceId(newDeviceId);
      start(newDeviceId);
  }

  return (
    <div className={className}>
      {error && (
         <Alert variant="destructive" className="mb-4">
             <CameraOff className="h-4 w-4" />
             <AlertTitle>Scanner Error</AlertTitle>
             <AlertDescription>{error}</AlertDescription>
         </Alert>
      )}
      <div className="space-y-4">
        <div style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
            <video
            ref={videoRef}
            className="w-full h-auto"
            muted
            playsInline
            autoPlay
            />
            <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
            <div style={{ width: '60%', aspectRatio: '1/1', border: '3px solid rgba(255,255,255,0.8)', borderRadius: 12, boxShadow: '0 0 0 2000px rgba(0,0,0,0.5)' }} />
            </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
            <Select value={deviceId ?? ''} onValueChange={handleCameraChange} disabled={!cameras.length}>
              <SelectTrigger className="flex-grow">
                <SelectValue placeholder={cameras.length ? 'Select camera' : 'No cameras'} />
              </SelectTrigger>
              <SelectContent>
                {cameras.map(cam => (
                    <SelectItem key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera ${cam.deviceId.slice(0, 4)}…`}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {torchSupported && (
                 <div className="flex items-center space-x-2">
                    <Label htmlFor="torch-mode">Torch</Label>
                    <Switch id="torch-mode" checked={torchOn} onCheckedChange={toggleTorch} />
                </div>
            )}
             <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                <span className="sr-only">Upload Image</span>
            </Button>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && onPickImage(e.target.files[0])} className="hidden" />

        </div>

        {zoomSupported && (
            <div className='space-y-2'>
            <Label>Zoom: {zoom?.toFixed?.(1)}x</Label>
             <Slider
                min={zoomMin}
                max={zoomMax}
                step={0.1}
                value={[zoom ?? zoomMin]}
                onValueChange={(vals) => changeZoom(vals[0])}
              />
            </div>
        )}
      </div>
    </div>
  );
}
