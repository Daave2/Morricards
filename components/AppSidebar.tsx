
'use client';

import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Home, ListChecks, Bot, Map, Settings, ShoppingBasket, ScanLine, CheckSquare, PackageSearch, AppWindow } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const navItems = [
    { href: '/picking', label: 'Picking List', icon: Home },
    { href: '/availability', label: 'Availability Report', icon: ListChecks },
    { href: '/assistant', label: 'Product Assistant', icon: Bot },
    { href: '/price-checker', label: 'Validator', icon: ScanLine },
    { href: '/planogram', label: 'Planogram', icon: CheckSquare },
    { href: '/map', label: 'Store Map', icon: Map },
    { href: '/amazon', label: 'Amazon', icon: PackageSearch },
    { href: '/storemapper', label: 'Store Mapper', icon: AppWindow },
    { href: '/settings', label: 'Settings', icon: Settings },
];


export default function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const isActive = (path: string) => {
    // Special case for root, so it doesn't stay active for all pages
    if (path === '/picking') {
        return pathname === path || pathname === '/';
    }
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
                <span className="text-lg theme-glass:text-white">Store Mobile Ultra</span>
            </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={isActive(item.href)}>
                <Link href={item.href} onClick={handleLinkClick}>
                  <item.icon />
                  {item.label}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
