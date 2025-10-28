
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
    { href: 'https://storemapper-ai-584939250419.us-west1.run.app', label: 'Store Mapper', icon: AppWindow, external: true },
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
          {navItems.map((item) => {
            const isExternal = item.external;
            const linkProps = isExternal ? { href: item.href, target: '_blank', rel: 'noopener noreferrer' } : { href: item.href };
            
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={!isExternal && isActive(item.href)}>
                  <a {...linkProps} onClick={handleLinkClick}>
                    <item.icon />
                    {item.label}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
