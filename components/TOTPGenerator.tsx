
'use client';

import { useEffect, useState } from 'react';
import { generateTOTP } from '@/lib/totp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

// This secret should ideally be stored securely or be user-configurable.
// For this example, it's hardcoded as it was likely used before.
const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

export default function TOTPGenerator() {
  const [otp, setOtp] = useState('------');
  const [remaining, setRemaining] = useState(0);

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

    // Update immediately and then set an interval
    updateOtp();
    const interval = setInterval(updateOtp, 1000);

    return () => clearInterval(interval);
  }, []);
  
  const progress = (remaining / 30) * 100;

  return (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <KeyRound /> One-Time Password
            </CardTitle>
            <CardDescription>
                For logging into legacy account services.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="text-center bg-muted p-4 rounded-lg">
                <p className="text-4xl font-bold tracking-widest font-mono">{otp}</p>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
                Expires in {remaining} seconds
            </p>
        </CardContent>
    </Card>
  );
}
