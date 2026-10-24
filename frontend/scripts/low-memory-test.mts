// Low-memory default: a 4 GB device starts on eco, a user's own choice is kept,
// and devices that do not report RAM are left alone.
const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v) },
  removeItem: (k: string) => { mem.delete(k) },
}

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

function setNavigator(deviceMemory: number | undefined) {
  Object.defineProperty(globalThis, 'navigator', {
    value: deviceMemory === undefined ? {} : { deviceMemory },
    configurable: true,
  })
}

const { useStore } = await import('../src/stores/useStore')
const { applyLowMemoryDefault, deviceMemoryGB } = await import('../src/lib/system/performance')

const reset = (patch: Record<string, unknown>) => {
  useStore.setState((s) => ({
    settings: { ...s.settings, performanceProfile: 'balanced', performanceProfileChosen: false, ...patch } as any,
  }))
}

// 4 GB, nothing chosen yet: starts on eco.
setNavigator(4)
reset({})
check('reports 4 GB', deviceMemoryGB() === 4)
applyLowMemoryDefault()
check('4 GB, no choice made: switches to eco', useStore.getState().settings.performanceProfile === 'eco')

// 8 GB: left on its profile.
setNavigator(8)
reset({})
applyLowMemoryDefault()
check('8 GB: profile unchanged', useStore.getState().settings.performanceProfile === 'balanced')

// 4 GB but the user picked a profile themselves: their choice wins.
setNavigator(4)
reset({ performanceProfileChosen: true, performanceProfile: 'performance' })
applyLowMemoryDefault()
check('4 GB with a user choice: the choice is kept', useStore.getState().settings.performanceProfile === 'performance')

// Browser does not report RAM (Safari, Firefox): no change.
setNavigator(undefined)
reset({})
applyLowMemoryDefault()
check('RAM not reported: profile unchanged', useStore.getState().settings.performanceProfile === 'balanced')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
