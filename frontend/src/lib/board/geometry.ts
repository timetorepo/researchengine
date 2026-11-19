export type CardGeometry = { x:number; y:number; width:number; height:number }
export const MIN_CARD_WIDTH = 160
export const MIN_CARD_HEIGHT = 120
/** Gesture deltas are already in board units; zoom conversion belongs to the pointer adapter. */
export function changedGeometry(base: CardGeometry, kind:'move'|'resize', dx:number, dy:number): CardGeometry {
  if (![dx,dy,base.x,base.y,base.width,base.height].every(Number.isFinite)) return {...base}
  return kind==='move'
    ? {...base,x:Math.max(0,Math.round(base.x+dx)),y:Math.max(0,Math.round(base.y+dy))}
    : {...base,width:Math.max(MIN_CARD_WIDTH,Math.round(base.width+dx)),height:Math.max(MIN_CARD_HEIGHT,Math.round(base.height+dy))}
}
export function sameGeometry(a:CardGeometry,b:CardGeometry) { return a.x===b.x && a.y===b.y && a.width===b.width && a.height===b.height }
