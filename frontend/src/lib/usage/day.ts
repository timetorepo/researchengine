/** Local calendar day (the user's machine, Asia/Jakarta here), YYYY-MM-DD. */
export function localDay(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA')
}
