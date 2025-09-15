
'use client';

import { Home, ListChecks, Bot, Map, ScanLine, Settings, CheckSquare, MoreHorizontal, Menu, PackageSearch } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Button } from './ui/button';
import { navItems } from './AppSidebar';

const mainNavItems = [
  { href: '/availability', label: 'Availability', icon: ListChecks },
  { href: '/assistant', label: 'Assistant', icon: Bot },
  { href: '/map', label: 'Map', icon: Map },
];

// All items that will go into the "More" sheet
const moreNavItems = navItems.filter(item => !mainNavItems.some(mainItem => mainItem.href === item.href));


export default function BottomNavbar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/picking' || path === '/') {
      return pathname === path || pathname === '/';
    }
    return pathname.startsWith(path);
  };
  
  const isMoreActive = moreNavItems.some(item => isActive(item.href));

  return (
    <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t bg-background md:hidden",
        "theme-glass:border-white/20 theme-glass:bg-black/10 theme-glass:backdrop-blur-xl"
    )}>
      <div className="grid h-16 grid-cols-4 items-center justify-center text-xs">
        {mainNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-primary',
              isActive(item.href) && 'text-primary',
              'theme-glass:text-white/70 theme-glass:hover:text-white',
              isActive(item.href) && 'theme-glass:text-white'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}

        <Sheet>
            <SheetTrigger asChild>
                 <button
                    className={cn(
                    'flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-primary',
                    isMoreActive && 'text-primary',
                    'theme-glass:text-white/70 theme-glass:hover:text-white',
                    isMoreActive && 'theme-glass:text-white'
                    )}
                >
                    <Menu className="h-5 w-5" />
                    <span>More</span>
                </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader className="text-left mb-4">
                    <SheetTitle>More Options</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-2 gap-4">
                    {moreNavItems.map((item) => (
                        <SheetTrigger asChild key={item.href}>
                             <Link
                                href={item.href}
                                className={cn(
                                'flex flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:text-primary rounded-lg p-4 bg-secondary',
                                isActive(item.href) && 'text-primary ring-2 ring-primary',
                                'theme-glass:bg-white/10 theme-glass:text-white/80',
                                isActive(item.href) && 'theme-glass:text-white theme-glass:bg-white/20'
                                )}
                            >
                                <item.icon className="h-6 w-6" />
                                <span className="truncate font-semibold">{item.label}</span>
                            </Link>
                        </SheetTrigger>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
