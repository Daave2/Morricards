'use client';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if(!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the A2HS prompt');
    } else {
      console.log('User dismissed the A2HS prompt');
    }
    setVisible(false);
    setDeferred(null);
  };
  
  const handleDismiss = () => {
      setVisible(false);
      setDeferred(null);
  }

  if (!visible || !deferred) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 rounded-2xl p-4 shadow-xl bg-background/80 backdrop-blur-sm border flex items-center gap-3 animate-in slide-in-from-bottom-10">
      <p className="font-semibold">Install the App?</p>
      <span className="text-sm text-muted-foreground hidden sm:inline">Get the full offline experience.</span>
      <Button className="ml-auto" onClick={handleInstallClick}>Install</Button>
      <Button variant="ghost" onClick={handleDismiss}>Later</Button>
    </div>
  );
}
