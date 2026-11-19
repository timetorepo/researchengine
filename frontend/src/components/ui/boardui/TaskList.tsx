/** Compatibility adapter: existing callers now render the actual MIT SortUI Trace. */
import { ActivityTrace } from '@/components/chat/ActivityTrace'
import type { ToolActivity } from '@/types'
export function BoardTaskList({ activities }: { activities: ToolActivity[] }) {
  return <ActivityTrace activities={activities} />
}
