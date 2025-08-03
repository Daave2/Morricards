'use client';

import Image from 'next/image';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Expand } from 'lucide-react';

interface ImageModalProps {
  src: string;
  alt: string;
  children: React.ReactNode;
}

export default function ImageModal({ src, alt, children }: ImageModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="p-0 border-0 max-w-2xl">
        <div className="relative aspect-square">
          <Image
            src={src}
            alt={alt}
            fill
            className="object-contain"
            data-ai-hint="product image large"
            unoptimized
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
