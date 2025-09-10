

'use client';

import { Home, ListChecks, Bot, Map, ScanLine, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/picking', label: 'Picking', icon: Home },
  { href: '/availability', label: 'Availability', icon: ListChecks },
  { href: '/assistant', label: 'Assistant', icon: Bot },
  { href: '/price-checker', label: 'Validator', icon: ScanLine },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function BottomNavbar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/picking') {
        // Special case for root path, should only match exactly
        return pathname === path || pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t bg-background md:hidden",
        "theme-glass:border-white/20 theme-glass:bg-black/10 theme-glass:backdrop-blur-xl"
    )}>
      <div className="grid h-16 grid-cols-5 items-center justify-center text-xs">
        {navItems.map((item) => (
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
      </div>
    </nav>
  );
}
