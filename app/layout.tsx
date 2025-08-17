
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from '@/components/theme-provider';
import AppLayout from '@/components/AppLayout';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'MorriCards',
  description: 'Your friendly shopping assistant.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5e9" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Check for the new token cookie and pass it as a search param
  // This is a workaround to pass server-side cookie data to a client component.
  const cookieStore = cookies();
  const newToken = cookieStore.get('new-bearer-token')?.value;
  
  // This logic is a bit of a hack to get the token to the client page.
  // A more robust solution might use a dedicated page or a different state management pattern.
  let childrenWithToken = children;
  if (newToken && (children as React.ReactElement)?.props?.childProp?.segment === 'settings') {
     const newProps = {
      ...((children as React.ReactElement).props),
      childProp: {
        ...((children as React.ReactElement).props.childProp),
        searchParams: { 'new-token': newToken }
      }
    };
    childrenWithToken = React.cloneElement(children as React.ReactElement, newProps);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AppLayout>
            {childrenWithToken}
          </AppLayout>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
