/**
 * Context menu — the shadcn/ui component (`context-menu`), on this app's tokens.
 *
 * The shadcn registry is unreachable from the build sandbox (the same is true of
 * the Watermelon, Skiper and Cult registries), so the component is written here
 * against Radix, which is what `npx shadcn@latest add context-menu` installs and
 * wraps. The API is kept identical — ContextMenu / ContextMenuTrigger /
 * ContextMenuContent / ContextMenuItem / ContextMenuSeparator / ContextMenuLabel
 * / ContextMenuShortcut / ContextMenuSub* — so anything written against shadcn's
 * docs works here unchanged. What differs is only the skin: Radix's data-state
 * attributes are dressed with this app's variables, so a menu looks right in all
 * twelve themes and in glass mode.
 */
import * as React from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { clsx } from 'clsx'

export const ContextMenu = ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger
export const ContextMenuGroup = ContextMenuPrimitive.Group
export const ContextMenuPortal = ContextMenuPrimitive.Portal
export const ContextMenuSub = ContextMenuPrimitive.Sub
export const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

export const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={clsx('re-ctx-item', inset && 'pl-8', className)}
    {...props}
  >
    {children}
    <ChevronRight size={13} className="ml-auto shrink-0" style={{ color: 'var(--text-3)' }} />
  </ContextMenuPrimitive.SubTrigger>
))
ContextMenuSubTrigger.displayName = 'ContextMenuSubTrigger'

export const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.SubContent ref={ref} className={clsx('re-ctx-content', className)} {...props} />
))
ContextMenuSubContent.displayName = 'ContextMenuSubContent'

export const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content ref={ref} className={clsx('re-ctx-content', className)} {...props} />
  </ContextMenuPrimitive.Portal>
))
ContextMenuContent.displayName = 'ContextMenuContent'

export const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & { inset?: boolean; tone?: 'danger' }
>(({ className, inset, tone, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    data-tone={tone}
    className={clsx('re-ctx-item', inset && 'pl-8', className)}
    {...props}
  />
))
ContextMenuItem.displayName = 'ContextMenuItem'

export const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem ref={ref} className={clsx('re-ctx-item pl-8', className)} checked={checked} {...props}>
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator><Check size={12} /></ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
))
ContextMenuCheckboxItem.displayName = 'ContextMenuCheckboxItem'

export const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem ref={ref} className={clsx('re-ctx-item pl-8', className)} {...props}>
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator><Circle size={7} fill="currentColor" /></ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
))
ContextMenuRadioItem.displayName = 'ContextMenuRadioItem'

export const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Label ref={ref} className={clsx('re-ctx-label', inset && 'pl-8', className)} {...props} />
))
ContextMenuLabel.displayName = 'ContextMenuLabel'

export const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator ref={ref} className={clsx('re-ctx-separator', className)} {...props} />
))
ContextMenuSeparator.displayName = 'ContextMenuSeparator'

export function ContextMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={clsx('re-ctx-shortcut', className)} {...props} />
}
