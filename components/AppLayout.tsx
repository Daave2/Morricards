'use client';

import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import BottomNavbar from './BottomNavbar';
import AppHeader from './AppHeader';
import { usePathname } from 'next/navigation';
import { navItems } from './AppSidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const getTitleForPath = () => {
    // Handle root redirect to /picking
    if (pathname === '/') return 'Picking List';
    
    // Find the nav item that matches the current path
    const currentNavItem = navItems.find(item => pathname.startsWith(item.href));
    return currentNavItem?.label || 'Store Mobile Ultra';
  }

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full flex-col">
        <Sidebar>
          <AppSidebar />
        </Sidebar>
        <div className="flex flex-col flex-1">
          <AppHeader title={getTitleForPath()} />
          <SidebarInset>
            <main className="flex-1 pb-24 md:pb-0">{children}</main>
          </SidebarInset>
        </div>
        <BottomNavbar />
      </div>
    </SidebarProvider>
  );
}
