

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
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
import { Settings, Trash2, Moon, Sun, DatabaseZap, DownloadCloud } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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

const FormSchema = z.object({
  bearerToken: z.string(),
  debugMode: z.boolean(),
});


export default function SettingsPage() {
  const { settings, setSettings, clearAllData } = useApiSettings();
  const { setTheme } = useTheme();
  const [isFetchingToken, setIsFetchingToken] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: settings,
  });
  
  useEffect(() => {
    form.reset(settings);
  }, [settings, form]);

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
    const tokenUrl = 'https://gist.githubusercontent.com/Daave2/b62faeed0dd435100773d4de775ff52d/raw/5c7d6426cb1406f0cae7d1f3d90f6bd497533943/gistfile1.txt';

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


  return (
    <>
      <main className="container mx-auto px-4 py-8 md:py-12">
          <Card>
              <CardHeader>
                  <CardTitle>Application Settings</CardTitle>
                  <CardDescription>
                      Manage API credentials, appearance, and other application settings. These are saved in your browser&apos;s local storage.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <div className="space-y-8">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base">
                                Theme
                            </FormLabel>
                            <FormDescription>
                                Select a theme for the application.
                            </FormDescription>
                        </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon">
                                <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                                <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                                <span className="sr-only">Toggle theme</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setTheme("light")}>
                                Light
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setTheme("dark")}>
                                Dark
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setTheme("system")}>
                                System
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                    </div>
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
                  </div>
                </Form>
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
                          <AlertDialogAction onClick={handleClearData}>
                              Yes, delete all data
                          </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </CardContent>
            </Card>
      </main>
    </>
  );
}
