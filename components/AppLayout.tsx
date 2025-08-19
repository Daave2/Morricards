
'use client';

import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import BottomNavbar from './BottomNavbar';
import AppHeader from './AppHeader';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full">
        <Sidebar>
          <AppSidebar />
        </Sidebar>
        <div className="flex flex-col flex-1">
          <AppHeader />
          <SidebarInset>
            <main className="flex-1 pb-24 md:pb-0">{children}</main>
          </SidebarInset>
        </div>
        <BottomNavbar />
      </div>
    </SidebarProvider>
  );
}

    