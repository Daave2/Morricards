
'use client';

import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { navItems } from "./AppSidebar";
import { cn } from "@/lib/utils";

export default function AppHeader() {
  const pathname = usePathname();

  const getTitleForPath = () => {
    // Handle root redirect to /picking
    if (pathname === '/') return 'Picking List';
    
    // Find the nav item that matches the current path
    const currentNavItem = navItems.find(item => pathname.startsWith(item.href));
    return currentNavItem?.label || 'Store Mobile Ultra';
  }
  
  const title = getTitleForPath();

  // Don't show header on picking list page for a cleaner look
  if (pathname === '/picking' || pathname === '/') {
    return null;
  }

  return (
    <header className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4",
        "glass-effect"
    )}>
      <SidebarTrigger className="sm:hidden" />
      <div className="w-full flex-1">
          <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
      </div>
    </header>
  );
}
