
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
import { Settings, Trash2, Moon, Sun, DatabaseZap, Copy } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';

const FormSchema = z.object({
  bearerToken: z.string(),
  debugMode: z.boolean(),
});

const getBookmarkletCode = () => {
    const endpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/bearer` : 'https://YOUR_APP_DOMAIN/api/bearer';
    return `javascript:(()=>{const ENDPOINT='${endpoint}';if(window.__tokCap){return alert('Token capturer already active.');}window.__tokCap=!0;const box=document.createElement('div');box.style.cssText='position:fixed;z-index:2147483647;left:12px;right:12px;bottom:12px;background:#0b0b0c;color:#fff;padding:12px;border-radius:10px;font:14px system-ui,Arial;box-shadow:0 6px 24px rgba(0,0,0,.5)';box.innerHTML='<div style="margin-bottom:8px;font-weight:600">Bearer Capturer</div><textarea id="__tok" style="width:100%;height:110px;border-radius:8px;padding:8px;border:1px solid #333;background:#111;color:#eee"></textarea><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button id="__tokSend" style="flex:1;min-width:120px;padding:10px;border-radius:8px;border:0;background:#2f7bff;color:#fff;font-weight:600">Send</button><button id="__tokCopy" style="flex:1;min-width:120px;padding:10px;border-radius:8px;border:1px solid #333;background:#1c1c1f;color:#fff">Copy</button><button id="__tokClose" style="padding:10px 12px;border-radius:8px;border:1px solid #333;background:#1c1c1f;color:#fff">Close</button><span id="__tokMsg" style="margin-left:auto;align-self:center;opacity:.8"></span></div>';document.body.appendChild(box);const t=box.querySelector('#__tok'),m=box.querySelector('#__tokMsg');function found(token){t.value=token;m.textContent='Captured.';}function patch(){const cap=(k,v)=>{if((k||'').toLowerCase()==='authorization'){const m=/bearer\\s+([^\\s]+)/i.exec(v||'');if(m&&m[1])found(m[1]);}};const of=window.fetch;window.fetch=async function(...args){try{const req=new Request(...args);for(const [k,v] of req.headers.entries()){cap(k,v);}return await of(req);}catch(e){return of(...args);}};const ox=XMLHttpRequest.prototype.setRequestHeader;XMLHttpRequest.prototype.setRequestHeader=function(k,v){try{cap(k,v);}catch(e){}return ox.apply(this,arguments);};}patch();box.querySelector('#__tokCopy').onclick=()=>{navigator.clipboard.writeText(t.value).then(()=>m.textContent='Copied.').catch(()=>m.textContent='Copy failed.');};box.querySelector('#__tokSend').onclick=()=>{const token=t.value.trim();if(!token){m.textContent='No token.';return;}m.textContent='Sending…';fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})}).then(r=>m.textContent=r.ok?'Sent.':'Failed: '+r.status).catch(()=>m.textContent='Error');};box.querySelector('#__tokClose').onclick=()=>{box.remove();window.__tokCap=!1;};})();`;
};

export default function SettingsPage() {
  const { settings, setSettings, clearAllData } = useApiSettings();
  const { setTheme } = useTheme()
  const [bookmarkletCode, setBookmarkletCode] = useState('');

  useEffect(() => {
    setBookmarkletCode(getBookmarkletCode());
  }, []);


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

  const handleCopyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode).then(() => {
        toast({ title: 'Bookmarklet Copied', description: 'The bookmarklet code has been copied to your clipboard.' });
    }).catch(() => {
        toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy the bookmarklet code.' });
    });
  }

  return (
    <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-primary">
                Settings
              </h1>
             <p className="mt-2 text-lg text-muted-foreground max-w-2xl mx-auto">
              Manage application settings. These are saved in your browser&apos;s local storage.
            </p>
          </header>

          <Card className="max-w-2xl mx-auto mb-8">
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

           <Card className="max-w-2xl mx-auto mb-8">
             <CardHeader>
                <CardTitle>Update Bearer Token via Bookmarklet (Recommended)</CardTitle>
                <CardDescription>
                    Use this bookmarklet on your mobile or desktop browser to easily capture a new token.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
                <p>
                    1. Copy the bookmarklet code below.
                </p>
                 <div className="relative">
                    <Textarea value={bookmarkletCode} readOnly className="h-32 font-mono text-xs" />
                    <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7" onClick={handleCopyBookmarklet}>
                        <Copy className="h-4 w-4" />
                    </Button>
                 </div>
                <p>
                    2. Create a new bookmark in your browser. Name it something like "Capture Token" and paste the copied code into the URL/Address field.
                </p>
                <p>
                    3. Log into the <a href="https://storemobile.apps.mymorri.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Morrisons Mobile Site</a>.
                </p>
                <p>
                    4. Once logged in, run the bookmarklet you created. A panel will appear at the bottom of the screen.
                </p>
                 <p>
                    5. Click "Copy" in the panel, then paste the token into the "Default Bearer Token" field above and click "Save Settings".
                </p>
            </CardContent>
          </Card>
          
          <Card className="max-w-2xl mx-auto mb-8">
             <CardHeader>
                <CardTitle>Update Bearer Token via Script (for Developers)</CardTitle>
                <CardDescription>
                    Alternatively, use this Node.js script to get a new token.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
                <p>
                    1. First, install the necessary dependencies if you haven't already:
                </p>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto"><code>npm install playwright axios</code></pre>
                <p>
                    2. Then, run the capture script from your terminal:
                </p>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto"><code>node capture-morrisons-token.js https://storemobile.apps.mymorri.com/ --verify "milk" --apikey 0GYtUV6tIhQ3a9rED9XUqiEQIbFhFktW</code></pre>
                <p>
                    3. A browser window will open. Log in with your credentials. Once you are logged in and the app is functional, return to your terminal.
                </p>
                <p>
                    4. Press Enter in the terminal. The script will save the new token in a file named <code className="font-mono bg-muted p-1 rounded-sm">morrisons-token.json</code>.
                </p>
                 <p>
                    5. Open the generated JSON file, copy the new token, paste it into the "Default Bearer Token" field above, and click "Save Settings".
                </p>
            </CardContent>
          </Card>

          <Card className="max-w-2xl mx-auto border-destructive/50">
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
  );
}
