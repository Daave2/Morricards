'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
import { Home, Settings, Trash2 } from 'lucide-react';
import Link from 'next/link';

const FormSchema = z.object({
  bearerToken: z.string(),
});

export default function SettingsPage() {
  const { settings, setSettings } = useApiSettings();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    values: settings,
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    setSettings(data);
    toast({
      title: 'Settings Saved',
      description: 'Your new settings have been saved locally.',
    });
  }

  function handleReset() {
    setSettings(DEFAULT_SETTINGS);
    form.reset(DEFAULT_SETTINGS);
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
                <CardTitle>API Credentials</CardTitle>
                <CardDescription>
                    Set the bearer token used to authenticate with the Morrisons API.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
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
                        <div className="flex justify-between">
                            <Button type="button" variant="destructive" onClick={handleReset}>
                                <Trash2 className="mr-2" />
                                Reset to Defaults
                            </Button>
                            <Button type="submit">Save Settings</Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
          </Card>
    </main>
  );
}
