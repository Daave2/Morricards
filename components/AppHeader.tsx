'use client';

import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSidebar } from "./ui/sidebar";

export default function AppHeader({ title }: { title: string }) {
  const { state: sidebarState } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:h-auto md:border-0 md:bg-transparent md:px-6 md:py-4">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="md:hidden" />
        <div className="w-full flex-1">
          <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
        </div>
      </div>
    </header>
  );
}
