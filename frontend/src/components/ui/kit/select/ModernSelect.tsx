/** Backwards-compatible entry point. Existing settings consumers now share the accessible BoardUI adapter. */
export { BoardSelect as ModernSelect, readOptions } from '@/components/ui/boardui/Select'
export type { BoardSelectProps as ModernSelectProps } from '@/components/ui/boardui/Select'
export interface SelectChange { target: { value: string } }
