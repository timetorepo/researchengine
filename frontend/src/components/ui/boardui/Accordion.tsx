import { Accordion } from '@base-ui/react/accordion'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
/** Original implementation of BoardUI's documented divided accordion design. */
export function BoardAccordion({ items }: { items: { id: string; title: ReactNode; content: ReactNode }[] }) {
  return <Accordion.Root multiple>{items.map((item) => <Accordion.Item key={item.id} value={item.id} className="bui-accordion-item">
    <Accordion.Header><Accordion.Trigger className="bui-accordion-trigger">{item.title}<ChevronDown size={16} aria-hidden="true" /></Accordion.Trigger></Accordion.Header>
    <Accordion.Panel className="bui-accordion-panel">{item.content}</Accordion.Panel>
  </Accordion.Item>)}</Accordion.Root>
}
