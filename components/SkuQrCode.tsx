
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { Skeleton } from './ui/skeleton';

interface SkuQrCodeProps {
  sku: string;
  size?: number;
}

export default function SkuQrCode({ sku, size = 128 }: SkuQrCodeProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  useEffect(() => {
    if (sku) {
      QRCode.toDataURL(sku, {
        width: size,
        margin: 1,
        errorCorrectionLevel: 'low',
      })
        .then(setQrCodeDataUrl)
        .catch((err) => {
          console.error('Failed to generate QR code for SKU', err);
          setQrCodeDataUrl(''); // Clear on error
        });
    }
  }, [sku, size]);

  if (!qrCodeDataUrl) {
    return <Skeleton className="w-[128px] h-[128px]" style={{width: `${size}px`, height: `${size}px`}} />;
  }

  return (
    <Image
      src={qrCodeDataUrl}
      alt={`QR Code for SKU ${sku}`}
      width={size}
      height={size}
      data-ai-hint="QR code SKU"
    />
  );
}
