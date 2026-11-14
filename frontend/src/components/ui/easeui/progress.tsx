/** Compatibility adapter: shared progress presentation now follows BoardUI. */
import { BoardProgress } from '@/components/ui/boardui/Progress'
export interface ProgressProps { value?: number; showValue?: boolean; className?: string }
export function Progress(props: ProgressProps) { return <BoardProgress {...props} label="Operation progress" /> }
