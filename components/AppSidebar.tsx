
'use client';

import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Home, ListChecks, Bot, Map, Settings, ShoppingBasket, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const isActive = (path: string) => {
    return pathname.startsWith(path);
  };

  const handleLinkClick = () => {
    setOpenMobile(false);
  }

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <Link href="/picking" className="flex items-center gap-2 font-semibold" onClick={handleLinkClick}>
                <ShoppingBasket className="h-6 w-6 text-primary" />
                <span className="text-lg">Store Mobile Ultra</span>
            </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/picking')}>
              <Link href="/picking" onClick={handleLinkClick}>
                <Home />
                Picking List
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/availability')}>
              <Link href="/availability" onClick={handleLinkClick}>
                <ListChecks />
                Availability Report
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/assistant')}>
              <Link href="/assistant" onClick={handleLinkClick}>
                <Bot />
                AI Product Assistant
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/price-checker')}>
              <Link href="/price-checker" onClick={handleLinkClick}>
                <ScanLine />
                AI Price Checker
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/map')}>
              <Link href="/map" onClick={handleLinkClick}>
                <Map />
                Store Map
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/settings')}>
              <Link href="/settings" onClick={handleLinkClick}>
                <Settings />
                Settings
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
