// The 3D keyboard listens to keys only when it is on AND the person has agreed to the
// disclaimer. Runs in Node with a fake localStorage and window.
import { readFileSync } from 'node:fs'

const store: Record<string, string> = {}
const events: string[] = []
;(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = String(v) },
  removeItem: (k: string) => { delete store[k] },
}
;(globalThis as any).window = { dispatchEvent: (e: { type: string }) => { events.push(e.type); return true } }
;(globalThis as any).Event = class { type: string; constructor(t: string) { this.type = t } }

const prefs = await import('../src/components/ui/kit/serenity/keyboardPrefs.ts')

let failures = 0
const check = (name: string, ok: boolean, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`) }

check('off by default: nothing listens', prefs.keyboardListening() === false)
prefs.setKeyboardEnabled(true)
check('turned on but never agreed: still nothing listens', prefs.keyboardListening() === false)
check('turning on tells the surfaces that read the setting', events.includes(prefs.KEYBOARD_EVENT))
prefs.grantKeyboardConsent()
check('on and agreed: listening is allowed', prefs.keyboardListening() === true)
prefs.setKeyboardEnabled(false)
check('turned off after agreeing: listening stops at once', prefs.keyboardListening() === false)
prefs.setKeyboardEnabled(true)
check('agreement is remembered, so turning on again does not ask again', prefs.readKeyboardConsent() === true && prefs.keyboardListening() === true)

// The listener itself must check the same rule on every key, and skip password fields.
const kb = readFileSync(new URL('../src/components/ui/kit/serenity/MechanicalKeyboard.tsx', import.meta.url), 'utf8')
check('the key listener checks consent on every key', /if \(!keyboardListening\(\)\) return/.test(kb))
check('the key listener ignores password fields', /type === 'password'\) return/.test(kb))
const dock = readFileSync(new URL('../src/components/ui/kit/serenity/MechanicalKeyboardDock.tsx', import.meta.url), 'utf8')
check('the dock shows the disclaimer before anything listens', /askConsent && enabled/.test(dock) && /!keyboardListening\(\)\) return null/.test(dock))
const app = readFileSync(new URL('../src/components/settings/AppearanceTab.tsx', import.meta.url), 'utf8')
check('Settings asks before it turns the keyboard on the first time', /if \(v && !readKeyboardConsent\(\)\) \{ setKbAsk\(true\); return \}/.test(app))

console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
process.exit(failures ? 1 : 0)
