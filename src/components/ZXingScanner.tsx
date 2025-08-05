// components/ZXingScanner.tsx
'use client';

import { Html5QrcodeScanner, Html5QrcodeScannerState } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';

type Props = {
    onResult: (text: string) => void;
    onError: (message: string) => void;
    className?: string;
};

const qrcodeRegionId = "html5qr-code-full-region";

export default function ZXingScanner({ onResult, onError, className }: Props) {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [] // Use all supported scan types
        };

        const qrCodeScanner = new Html5QrcodeScanner(
            qrcodeRegionId,
            config,
            /* verbose= */ false
        );
        scannerRef.current = qrCodeScanner;

        const startScanner = () => {
            if (scannerRef.current && scannerRef.current.getState() !== Html5QrcodeScannerState.SCANNING) {
                qrCodeScanner.render(onResult, (errorMessage) => {
                    // This is the error callback, but we ignore 'Code not found' errors.
                    if (!errorMessage.toLowerCase().includes('code not found')) {
                        onError(errorMessage);
                    }
                });
                setIsScanning(true);
            }
        }
        
        startScanner();
        
        // Add a listener to restart the scanner if it stops (e.g., due to inactivity)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && scannerRef.current && scannerRef.current.getState() !== Html5QrcodeScannerState.SCANNING) {
                    const container = document.getElementById(qrcodeRegionId);
                    if(container && !container.querySelector('video')) {
                       // The video element is gone, so the scanner has stopped. Restart it.
                       startScanner();
                    }
                }
            });
        });

        const container = document.getElementById(qrcodeRegionId);
        if (container) {
            observer.observe(container, { childList: true, subtree: true });
        }


        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => {
                    console.error("Failed to clear html5-qrcode-scanner.", error);
                });
            }
             if (observer) {
                observer.disconnect();
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onResult, onError]);

    return (
        <div id={qrcodeRegionId} className={className}></div>
    );
}
