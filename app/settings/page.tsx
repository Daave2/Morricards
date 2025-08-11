
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
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
import { Home, Settings, Trash2, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const FormSchema = z.object({
  bearerToken: z.string(),
  debugMode: z.boolean(),
});

export default function SettingsPage() {
  const { settings, setSettings } = useApiSettings();
  const { setTheme } = useTheme()


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

  return (
    <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-12">
            <div className="inline-flex items-center gap-4">
               <Settings className="w-12 h-12 text-primary" />
              <h1 className="text-5xl font-bold tracking-tight text-primary">
                Settings
              </h1>
            </div>
             <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Manage application settings. These are saved in your browser&apos;s local storage.
            </p>
             <Button variant="link" asChild className="mt-2">
                <Link href="/">
                    <Home className="mr-2 h-4 w-4" />
                    Back to Picking List
                </Link>
            </Button>
          </header>

          <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Application Settings</CardTitle>
                <CardDescription>
                    Manage API credentials, appearance, and other application settings.
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
                              <FormControl>
                                  <Input placeholder="Enter bearer token..." {...field} />
                              </FormControl>
                              <FormDescription>
                              This token is used for certain API requests.
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
                          <Button type="button" variant="destructive" onClick={handleReset}>
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
    </main>
  );
}
