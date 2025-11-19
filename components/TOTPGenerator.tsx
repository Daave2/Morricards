
'use-client';

import { useEffect, useState } from 'react';
import { generateTOTP } from '@/lib/totp';
import { KeyRound, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const TOTP_SECRET = 'TYX3MCRGZYWI7RKQFV55ATV7ATGB7LOOXSTF7YXO2EUKQEGOPV7Q';

export default function TOTPGenerator() {
  const [otp, setOtp] = useState('------');
  const [remaining, setRemaining] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    async function updateOtp() {
      try {
        const token = await generateTOTP(TOTP_SECRET, { period: 30 });
        setOtp(token.otp);
        setRemaining(token.remaining);
      } catch (error) {
        console.error('Failed to generate TOTP:', error);
        setOtp('Error');
        setRemaining(0);
      }
    }

    updateOtp();
    const interval = setInterval(updateOtp, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    if (otp !== '------' && otp !== 'Error') {
      navigator.clipboard.writeText(otp);
      toast({
        title: 'Copied to Clipboard',
        description: `The code ${otp} has been copied.`,
      });
    }
  };
  
  const progress = (remaining / 30) * 100;

  return (
    <div 
        className="relative w-full border rounded-lg p-1.5 flex items-center justify-between cursor-pointer hover:bg-accent transition-colors"
        onClick={handleCopy}
    >
        <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <p className="text-base font-bold tracking-wider font-mono">{otp}</p>
        </div>
        <Copy className="h-4 w-4 text-muted-foreground" />
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted/50 rounded-b-lg overflow-hidden">
            <div 
                className="h-full bg-primary transition-all duration-1000 linear"
                style={{ width: `${progress}%` }}
            />
        </div>
    </div>
  );
}
