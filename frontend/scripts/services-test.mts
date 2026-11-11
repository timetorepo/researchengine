/**
 * Built-in services, checked in Node:
 *
 *  1. Lines: SEO, CRM and SOCIAL lines are read with their arguments; prose is not.
 *  2. Drafts and adds are parsed, but a bad JSON or a bad draft is an answer, not a tool.
 *  3. Readiness: a service is ready when it has a key, or is a local VoiceStudio.
 *  4. Voices: only permitted (cloned with consent) or built-in voices can be spoken; a
 *     recorded consent is found by name or id, and the list keeps at most 50.
 *  5. Keys: saving with no new key keeps the saved one; removing clears it.
 *  6. Prompt: unconfigured services are not offered to the model.
 *
 * Run: npm run services-test --workspace frontend
 */
// The store persists to localStorage; Node has none, so a stand-in is installed first.
const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v) },
  removeItem: (k: string) => { mem.delete(k) },
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
}
;(globalThis as any).window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true }, location: { origin: 'http://x', search: '', href: 'http://x/' } }
;(globalThis as any).document = (globalThis as any).document ?? { hidden: false, addEventListener() {}, removeEventListener() {} }

const { findToolCall, stripToolLines } = await import('../src/lib/bots/logic.ts')
const config = await import('../src/lib/services/config.ts')
const { useStore } = await import('../src/stores/useStore.ts')

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('1. Lines')
const one = (line: string) => findToolCall(line, { web: false })
check('SEO: with a domain asks for an overview', one('SEO: example.com')?.kind === 'seo_domain' && (one('SEO: example.com') as any).domain === 'example.com')
check('SEO: a URL is accepted as a site', (one('SEO: https://example.com/pricing') as any)?.kind === 'seo_domain')
check('SEO: KEYWORDS takes up to five seeds', (one('SEO: KEYWORDS coffee beans, espresso, cold brew, latte, mocha, extra') as any)?.seeds.length === 5)
check('SEO: KEYWORDS with nothing after it is ignored', one('SEO: KEYWORDS') === null)
check('SEO: a sentence after the keyword is not a domain', one('SEO: is a measure of search') === null)
check('CRM: FIND asks for people', (one('CRM: FIND Ana Lima') as any)?.companies === false && (one('CRM: FIND Ana Lima') as any)?.query === 'Ana Lima')
check('CRM: COMPANIES asks for companies', (one('CRM: COMPANIES Acme') as any)?.companies === true)
check('CRM: a single letter is too short to search', one('CRM: FIND A') === null)
const add = one('CRM: ADD {"kind":"people","firstName":"Ana","email":"ana@example.com"}') as any
check('CRM: ADD reads a JSON record', add?.kind === 'crm_add' && add.record.firstName === 'Ana')
check('CRM: ADD with bad JSON is an answer, not a tool', one('CRM: ADD {kind: people') === null)
check('SOCIAL: CHANNELS lists channels', one('SOCIAL: CHANNELS')?.kind === 'social_channels')
const draft = one('SOCIAL: DRAFT ch_12 | Shipping the new release today.') as any
check('SOCIAL: DRAFT takes the channel id and the text', draft?.kind === 'social_draft' && draft.channelId === 'ch_12' && draft.text === 'Shipping the new release today.')
check('SOCIAL: DRAFT with no text is ignored', one('SOCIAL: DRAFT ch_12') === null)
check('ordinary prose with a colon is not a tool', one('Seo: a word in a sentence') === null && one('Social: we posted') === null)
check('the first tool line wins', (findToolCall('SEO: example.com\nCRM: FIND Ana', { web: false }) as any)?.kind === 'seo_domain')
check('older lines still read (DOCS)', (one('DOCS: next.js | how do route handlers stream?') as any)?.kind === 'docs')
const reply = 'Here is the overview.\nSEO: example.com\nCRM: FIND Ana'
check('stripping removes the new lines and keeps the answer', stripToolLines(reply) === 'Here is the overview.')

console.log('2. Readiness')
check('OpenSEO is not ready without a key', !config.serviceReady('openseo'))
check('VoiceStudio on this machine is ready with no key', config.serviceReady('voicestudio'))
await config.saveService('voicestudio', { url: 'https://vs.example.com' })
check('a remote VoiceStudio needs a key', !config.serviceReady('voicestudio'))
await config.saveService('voicestudio', { url: 'http://127.0.0.1:3900' })
await config.saveService('twenty', { url: '', key: 'tw_KEY' })
check('a saved key makes a service ready', config.serviceReady('twenty'))
check('the saved key is kept on the device settings', useStore.getState().settings.services?.twenty?.token === 'tw_KEY')

console.log('3. Keys')
await config.saveService('twenty', { url: 'https://crm.example.com' })
check('saving with no new key keeps the saved key', useStore.getState().settings.services?.twenty?.token === 'tw_KEY')
check('the address is saved with it', useStore.getState().settings.services?.twenty?.url === 'https://crm.example.com')
await config.saveService('twenty', { url: '', key: '' })
check('an empty key removes it', !config.serviceReady('twenty') && !useStore.getState().settings.services?.twenty?.token)
await config.saveService('openseo', { key: 'oseo_K', projectId: ' proj_1 ' })
check('the OpenSEO project is kept, trimmed', config.openseoProject() === 'proj_1')

console.log('4. Voices')
check('no permitted voice to start with', config.permittedVoice('Ana') === undefined)
const rec = config.recordConsent({ speaker: 'Ana Lima', voiceId: 'prof_42' })
check('a consent is recorded with a time', rec.grantedAt > 0 && rec.id.length > 0)
check('a permitted voice is found by name, any case', config.permittedVoice('ana lima')?.voiceId === 'prof_42')
check('a permitted voice is found by its id', config.permittedVoice('prof_42')?.speaker === 'Ana Lima')
check('an unknown name is not permitted', config.permittedVoice('Bob') === undefined)
config.forgetConsent(rec.id)
check('removing a consent removes the voice', config.permittedVoice('Ana Lima') === undefined)
for (let i = 0; i < 55; i++) config.recordConsent({ speaker: `Speaker ${i}`, voiceId: `v${i}` })
check('the list of permitted voices keeps at most 50', config.voiceConsents().length === 50)

console.log('5. Prompt')
const { toolSpecs } = await import('../src/lib/chat/tools.ts')
const names = (ctx: any) => toolSpecs(ctx).map((t) => t.function.name)
await config.saveService('openseo', { key: '' })
await config.saveService('twenty', { key: '' })
await config.saveService('postiz', { key: '' })
check('unconfigured services are not offered to the model', !names({}).some((n) => n.startsWith('seo_') || n.startsWith('crm_') || n.startsWith('social_')))
await config.saveService('openseo', { key: 'oseo_K' })
check('a configured service is offered', names({}).includes('seo_domain') && names({}).includes('seo_keywords'))
check('voice_speak is offered with a local VoiceStudio', names({}).includes('voice_speak'))
check('there is no clone tool for the agent', !names({}).some((n) => /clone/.test(n)))

{
  const { connectorInstructions } = await import('../src/lib/bots/logic.ts')
  const none = connectorInstructions({})
  const some = connectorInstructions({ seo: true, social: true })
  check('bot prompt has no service lines when none is set up', !/SEO:|CRM:|SOCIAL:/.test(none))
  check('bot prompt describes only the set-up services', /SEO: <domain>/.test(some) && /SOCIAL: DRAFT/.test(some) && !/CRM: FIND/.test(some))
}

console.log(`\nservices-test: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
