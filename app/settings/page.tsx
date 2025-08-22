'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useApiSettings, DEFAULT_SETTINGS } from '@/hooks/use-api-settings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Trash2, Moon, Sun, DatabaseZap, DownloadCloud, Sparkles, Paintbrush, UploadCloud, Image as ImageIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomTheme } from '@/hooks/useCustomTheme';

const FormSchema = z.object({
  bearerToken: z.string(),
  debugMode: z.boolean(),
});


export default function SettingsPage() {
  const { settings, setSettings, clearAllData } = useApiSettings();
  const { theme, setTheme } = useTheme();
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { hasCustomBackground, setCustomBackground, removeCustomBackground } = useCustomTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: settings,
  });
  
  useEffect(() => {
    if (isClient) {
      form.reset(settings);
    }
  }, [settings, form, isClient]);

  function onSubmit(data: z.infer<typeof FormSchema>) {
    setSettings(data);
    toast({
      title: 'Settings Saved',
      description: 'Your new settings have been saved locally.',
    });
  }

  function handleReset() {
    setSettings(DEFAULT_SETTINGS);
    toast({
      title: 'Settings Reset',
      description: 'Your settings have been reset to their default values.',
    });
  }

  function handleClearData() {
    clearAllData();
    toast({
      title: 'Application Data Cleared',
      description: 'All lists and offline data have been removed.',
    });
  }
  
  async function handleFetchToken() {
    setIsFetchingToken(true);
    const tokenUrl = 'https://gist.githubusercontent.com/Daave2/b62faeed0dd435100773d4de775ff52d/raw/fede6ee0bcb19abb99baa7e46b9c44c4d3e09b0d/gistfile1.txt';

    try {
      const response = await fetch(tokenUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch token: ${response.statusText}`);
      }
      const token = await response.text();
      const trimmedToken = token.trim();

      if (!trimmedToken) {
          throw new Error('Fetched token is empty.');
      }

      form.setValue('bearerToken', trimmedToken);
      setSettings({ ...settings, bearerToken: trimmedToken });
      toast({
        title: 'Token Updated',
        description: 'The latest bearer token has been fetched and saved.',
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({
        variant: 'destructive',
        title: 'Fetch Failed',
        description: `Could not fetch the token. ${errorMessage}`,
      });
      console.error(error);
    } finally {
      setIsFetchingToken(false);
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setCustomBackground(dataUrl);
        toast({ title: 'Background Updated', description: 'Your custom background has been set.' });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveBackground = () => {
    removeCustomBackground();
    toast({ title: 'Background Removed', description: 'The custom background has been removed.' });
  };


  return (
      <main className="container mx-auto px-4 py-8 md:py-12">
          <Card>
              <CardHeader>
                  <CardTitle>Application Settings</CardTitle>
                  <CardDescription>
                      Manage API credentials, appearance, and other application settings. These are saved in your browser's local storage.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                    <div className="space-y-4 rounded-lg border p-4">
                        <FormLabel className="text-base">Theme</FormLabel>
                        <FormDescription>Select a theme for the application.</FormDescription>
                        {!isClient ? (
                           <div className="grid max-w-md grid-cols-2 gap-8 pt-2">
                             <Skeleton className="h-24 w-full" />
                             <Skeleton className="h-24 w-full" />
                             <Skeleton className="h-24 w-full" />
                           </div>
                        ) : (
                         <RadioGroup
                            value={theme}
                            onValueChange={setTheme}
                            className="grid max-w-md grid-cols-2 gap-8 pt-2"
                        >
                            <FormItem>
                                <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                                    <FormControl>
                                        <RadioGroupItem value="light" className="sr-only" />
                                    </FormControl>
                                    <div className="items-center rounded-md border-2 border-muted p-1 hover:border-accent">
                                        <div className="space-y-2 rounded-sm bg-[#ecedef] p-2">
                                            <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
                                                <div className="h-2 w-[80px] rounded-lg bg-[#ecedef]" />
                                                <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                                            </div>
                                            <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                                                <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
                                                <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                                            </div>
                                        </div>
                                    </div>
                                    <span className="block w-full p-2 text-center font-normal">Light</span>
                                </FormLabel>
                            </FormItem>
                             <FormItem>
                                <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                                    <FormControl>
                                        <RadioGroupItem value="dark" className="sr-only" />
                                    </FormControl>
                                    <div className="items-center rounded-md border-2 border-muted bg-popover p-1 hover:bg-accent hover:text-accent-foreground">
                                        <div className="space-y-2 rounded-sm bg-slate-950 p-2">
                                            <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                                                <div className="h-2 w-[80px] rounded-lg bg-slate-400" />
                                                <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
                                            </div>
                                            <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                                                <div className="h-4 w-4 rounded-full bg-slate-400" />
                                                <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
                                            </div>
                                        </div>
                                    </div>
                                    <span className="block w-full p-2 text-center font-normal">Dark</span>
                                </FormLabel>
                            </FormItem>
                            <FormItem>
                                <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                                    <FormControl>
                                        <RadioGroupItem value="theme-glass" className="sr-only" />
                                    </FormControl>
                                    <div className="items-center rounded-md border-2 border-muted p-1 hover:border-accent">
                                        <div className="space-y-2 rounded-sm bg-slate-950 p-2 bg-cover bg-center" style={{ backgroundImage: "url('/Background.png')"}}>
                                            <div className="space-y-2 rounded-md bg-white/20 p-2 shadow-sm backdrop-blur-sm">
                                                <div className="h-2 w-[80px] rounded-lg bg-slate-400/50" />
                                                <div className="h-2 w-[100px] rounded-lg bg-slate-400/50" />
                                            </div>
                                            <div className="flex items-center space-x-2 rounded-md bg-white/20 p-2 shadow-sm backdrop-blur-sm">
                                                <div className="h-4 w-4 rounded-full bg-slate-400/50" />
                                                <div className="h-2 w-[100px] rounded-lg bg-slate-400/50" />
                                            </div>
                                        </div>
                                    </div>
                                    <span className="block w-full p-2 text-center font-normal">Glass</span>
                                </FormLabel>
                            </FormItem>
                             <FormItem>
                                <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                                    <FormControl>
                                        <RadioGroupItem value="theme-dark-gradient" className="sr-only" />
                                    </FormControl>
                                    <div className="items-center rounded-md border-2 border-muted p-1 hover:border-accent">
                                        <div className="h-[96px] w-full rounded-sm" style={{ background: 'linear-gradient(160deg, hsl(280, 50%, 15%), hsl(240, 60%, 10%), hsl(220, 70%, 8%))' }} />
                                    </div>
                                    <span className="block w-full p-2 text-center font-normal">Dark Gradient</span>
                                </FormLabel>
                            </FormItem>
                        </RadioGroup>
                        )}
                    </div>
                    {theme === 'theme-glass' && isClient && (
                      <div className="space-y-4 rounded-lg border p-4">
                        <FormLabel className="text-base flex items-center gap-2"><ImageIcon /> Custom Background</FormLabel>
                        <FormDescription>Upload your own background image for the glass theme.</FormDescription>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={handleUploadClick}>
                            <UploadCloud className="mr-2 h-4 w-4" />
                            Upload Image
                          </Button>
                          {hasCustomBackground && (
                            <Button variant="destructive" onClick={handleRemoveBackground}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <FormField
                        control={form.control}
                        name="bearerToken"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Default Bearer Token</FormLabel>
                                <div className="flex gap-2">
                                  <FormControl>
                                      <Input placeholder="Enter bearer token..." {...field} />
                                  </FormControl>
                                   <Button type="button" variant="outline" onClick={handleFetchToken} disabled={isFetchingToken}>
                                    <DownloadCloud className="mr-2 h-4 w-4" />
                                    {isFetchingToken ? 'Fetching...' : 'Fetch Latest'}
                                  </Button>
                                </div>
                                <FormDescription>
                                This token is used for certain API requests. It may expire.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                          control={form.control}
                          name="debugMode"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Debug Mode
                                </FormLabel>
                                <FormDescription>
                                  Show detailed error information for API requests.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-between">
                            <Button type="button" variant="outline" onClick={handleReset}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Reset to Defaults
                            </Button>
                            <Button type="submit">Save Settings</Button>
                        </div>
                    </form>
                    </Form>
                  </div>
              </CardContent>
            </Card>
            
            <Card className="mt-8 border-destructive/50">
               <CardHeader>
                  <CardTitle>Data Management</CardTitle>
                  <CardDescription>
                      Permanently clear all stored application data from this browser, including picking lists and offline items.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full">
                              <DatabaseZap className="mr-2 h-4 w-4" />
                              Clear All Application Data
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete all picking lists, availability reports, and queued offline data from this device.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleClearData}>Clear All Data</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </CardContent>
            </Card>
      </main>
  );
}
