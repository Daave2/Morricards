
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from '@/components/theme-provider';
import AppLayout from '@/components/AppLayout';
import CustomThemeProvider from '@/components/CustomThemeProvider';

export const metadata: Metadata = {
  title: 'MorriCards',
  description: 'Your friendly shopping assistant.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
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
          themes={['light', 'dark', 'theme-glass', 'theme-dark-gradient']}
        >
          <CustomThemeProvider>
            <AppLayout>
              {children}
            </AppLayout>
            <Toaster />
          </CustomThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
