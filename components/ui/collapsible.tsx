
"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

import { cn } from "@/lib/utils"
import React from "react"

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden transition-all duration-300 ease-in-out",
      "data-[state=closed]:opacity-0 data-[state=closed]:-translate-y-2 data-[state=closed]:h-0",
      "data-[state=open]:opacity-100 data-[state=open]:translate-y-0",
      className
    )}
    {...props}
  >
    {children}
  </CollapsiblePrimitive.Content>
))

CollapsibleContent.displayName = CollapsiblePrimitive.Content.displayName


export { Collapsible, CollapsibleTrigger, CollapsibleContent }
