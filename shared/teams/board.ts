/** Portable Board protocol validation; no IO or local-Board access. */
export type TeamItem = {
  id: string; kind: 'note'|'reference'|'image'|'pdf'|'drawing'|'shape'|'connector'|'frame'
  x: number; y: number; width: number; height: number; text: string
  textFormat?: 'markdown'; shape?: 'rectangle'|'ellipse'|'diamond'; pointSpace?: 'unit'
  attachmentId?: string; source?: { url?: string; page?: number }; parentId?: string
  points?: { x: number; y: number }[]; fromId?: string; toId?: string
}
export type TeamBoard = { id: string; revision: number; title: string; items: TeamItem[] }
const own=(value:object,key:PropertyKey)=>Object.prototype.hasOwnProperty.call(value,key)
const fail = (message: string): never => { throw new Error(message) }
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)
const attachment = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
function record(v: unknown, required: string[], optional: string[] = []): asserts v is Record<string, any> {
  if (!v || typeof v !== 'object' || Object.getPrototypeOf(v) !== Object.prototype || required.some(key => !own(v, key)) || Reflect.ownKeys(v).some(key => typeof key !== 'string' || ![...required, ...optional].includes(key) || !Object.getOwnPropertyDescriptor(v, key)?.enumerable || !own(Object.getOwnPropertyDescriptor(v, key)!, 'value'))) fail('Invalid or unsupported protocol fields')
}
function list(v: unknown): asserts v is unknown[] {
  if (!Array.isArray(v) || Reflect.ownKeys(v).length !== v.length + 1 || Object.keys(v).length !== v.length || Object.keys(v).some((key, i) => key !== String(i) || !own(Object.getOwnPropertyDescriptor(v,key)!, 'value'))) fail('Invalid protocol array')
}
export function validateSharedBoardItems(value: unknown): asserts value is TeamItem[] {
  list(value)
  const byId = new Map<string, TeamItem>()
  for (const item of value) {
    record(item, ['id','kind','x','y','width','height','text'], ['textFormat','shape','pointSpace','attachmentId','source','parentId','points','fromId','toId'])
    if (!id(item.id) || byId.has(item.id) || !['note','reference','image','pdf','drawing','shape','connector','frame'].includes(item.kind) || ![item.x,item.y,item.width,item.height].every(finite) || item.width <= 0 || item.height <= 0 || typeof item.text !== 'string') fail('Invalid Board item')
    if (own(item,'textFormat') && item.textFormat !== 'markdown') fail('Invalid text format')
    if (own(item,'shape') && (item.kind !== 'shape' || !['rectangle','ellipse','diamond'].includes(item.shape))) fail('Invalid shape')
    if (own(item,'attachmentId') && !attachment(item.attachmentId)) fail('Invalid attachment identity')
    if (['image','pdf'].includes(item.kind) && !attachment(item.attachmentId)) fail('Image/PDF needs an original attachment')
    for (const field of ['parentId','fromId','toId']) if (own(item,field) && !id(item[field])) fail('Invalid Board link identity')
    if (own(item,'source')) {
      record(item.source, [], ['url','page'])
      if (own(item.source,'page') && (!integer(item.source.page) || item.source.page < 1)) fail('Invalid source page')
      if (own(item.source,'url')) {
        if (typeof item.source.url !== 'string') fail('Invalid source URL')
        let url: URL; try { url = new URL(item.source.url) } catch { fail('Invalid source URL') }
        if (!['http:','https:'].includes(url!.protocol)) fail('Unsupported source URL')
      }
    }
    if (own(item,'points')) {
      list(item.points)
      for (const point of item.points) { record(point,['x','y']); if (!finite(point.x) || !finite(point.y)) fail('Invalid drawing point') }
      if (item.kind !== 'drawing') fail('Drawing points on a non-drawing')
    }
    if (own(item,'pointSpace') && (item.kind !== 'drawing' || item.pointSpace !== 'unit' || !item.points?.length || item.points.some((p: {x:number;y:number}) => p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1))) fail('Invalid normalized drawing')
    if (item.kind === 'connector' && (!id(item.fromId) || !id(item.toId) || item.fromId === item.toId)) fail('Connector needs distinct endpoints')
    if (item.kind !== 'connector' && (own(item,'fromId') || own(item,'toId'))) fail('Endpoints on a non-connector')
    byId.set(item.id, item as TeamItem)
  }
  for (const item of byId.values()) {
    for (const target of [item.parentId,item.fromId,item.toId]) if (target && (target === item.id || !byId.has(target))) fail('Missing/self Board target')
    if (item.parentId && byId.get(item.parentId)?.kind !== 'frame') fail('Parent must be a frame')
    if (item.kind === 'connector' && [item.fromId!,item.toId!].some(target => byId.get(target)?.kind === 'connector')) fail('Connector-to-connector link')
    const seen = new Set([item.id]); let parent = item.parentId
    while (parent) { if (seen.has(parent)) fail('Cyclic Board frames'); seen.add(parent); parent = byId.get(parent)?.parentId }
  }
}
export function sharedBoards(value:unknown,sequence:number):TeamBoard[]{
 list(value);const seen=new Set<string>()
 for(const board of value){record(board,['id','revision','title','items']);if(!id(board.id)||seen.has(board.id)||!integer(board.revision)||board.revision<1||board.revision>sequence||typeof board.title!=='string')fail('Invalid shared Board');validateSharedBoardItems(board.items);seen.add(board.id)}
 return structuredClone(value) as TeamBoard[]
}
