export function luminance(hex: string): number {
  const channels = hex.slice(1).match(/../g)!.map((v) => parseInt(v, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
}
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}
export function paletteTokens(colours: string[]): Record<string, string> | null {
  if (colours.length < 3 || colours.length > 5 || !colours.every((c) => /^#[\da-f]{6}$/i.test(c))) return null
  const ordered = [...colours].sort((a, b) => luminance(a) - luminance(b))
  const bg = ordered[0]; let surface = ordered[1]; const accent = ordered[ordered.length - 1]
  const text = contrast('#ffffff', bg) >= contrast('#000000', bg) ? '#ffffff' : '#000000'
  if (contrast(text, surface) < 4.5) surface = bg
  // Same strong foreground for secondary text rather than an unverified low-contrast blend.
  return { '--bg': bg, '--surface': surface, '--elevated': surface, '--text': text, '--text-2': text, '--text-3': text, '--primary': accent, '--secondary': ordered[ordered.length - 2], '--surface-border': text === '#ffffff' ? '#777777' : '#555555' }
}
export function paletteCSS(name: string, colours: string[]): string {
  const tokens = paletteTokens(colours)
  if (!tokens) throw new Error('Invalid palette')
  const safeName = name.replace(/[^a-z0-9 -]/gi, '').slice(0, 60) || 'Research palette'
  return `/* ${safeName} — ResearchEngine palette theme */\n:root {\n${Object.entries(tokens).map(([key, value]) => `  ${key}: ${value};`).join('\n')}\n}\n`
}
