
'use client';

import { SidebarTrigger } from "@/components/ui/sidebar";

export default function AppHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
      <SidebarTrigger className="md:hidden" />
      <div className="w-full flex-1">
        <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
      </div>
    </header>
  );
}
