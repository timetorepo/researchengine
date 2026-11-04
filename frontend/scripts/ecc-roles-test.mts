/**
 * ECC roles behind plain names, checked in Node against src/lib/ecc/roles.ts.
 *
 *  1. Coverage: all 71 ECC roles sit in exactly one family, and every family member exists.
 *  2. Names: the families have plain names, unique ids, and a blurb each.
 *  3. Selection: a request picks the ECC members it is about, at most MAX_ROLES_PER_REPLY.
 *  4. Custom instructions count too: the bot's job can pick a member the request does not name.
 *  5. Fallback: a request that matches nothing gets the family's lead member, alone.
 *  6. Method text: named family and members, each member's own ECC text, capped in total.
 *  7. Legacy: a bot that stored one ECC agent id resolves to its family.
 *
 * Run: npm run ecc-roles-test --workspace frontend
 */
import { ECC_AGENTS } from '../src/content/ecc/agents.ts'
import { ECC_AGENT_META } from '../src/content/ecc/meta.ts'
import {
  MAX_ROLE_TEXT, MAX_ROLES_PER_REPLY, ROLE_FAMILIES, familyById, familyForRole, familyOfAgent,
  roleText, selectMembers, unassignedAgents,
} from '../src/lib/ecc/roles.ts'

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('1. Coverage')
const counts = new Map<string, number>()
for (const f of ROLE_FAMILIES) for (const m of f.members) counts.set(m, (counts.get(m) ?? 0) + 1)
check(`all ${ECC_AGENTS.length} ECC roles are in a family`, unassignedAgents().length === 0, unassignedAgents().join(', '))
check('no role is in two families', [...counts.values()].every((n) => n === 1), [...counts].filter(([, n]) => n > 1).map(([k]) => k).join(', '))
check('every family member exists in the vendored file', [...counts.keys()].every((id) => ECC_AGENTS.some((a) => a.id === id)), [...counts.keys()].filter((id) => !ECC_AGENTS.some((a) => a.id === id)).join(', '))
check('the family members add up to every role', [...counts.keys()].length === ECC_AGENTS.length)

console.log('2. Names')
const names = ROLE_FAMILIES.map((f) => f.name)
check('family names are unique', new Set(names).size === names.length)
check('family ids are unique', new Set(ROLE_FAMILIES.map((f) => f.id)).size === ROLE_FAMILIES.length)
check('each family has a blurb', ROLE_FAMILIES.every((f) => f.blurb.length > 20))
check('Researcher and Workflow are offered by name', names.includes('Researcher') && names.includes('Workflow'))
check('no family is named after an ECC role', ROLE_FAMILIES.every((f) => !ECC_AGENTS.some((a) => a.name === f.id)))

console.log('3. Selection by request')
const research = familyById('researcher')!
const reviewer = familyById('reviewer')!
const builder = familyById('builder')!
const pick = (f: typeof research, req: string, ins = '') => selectMembers(f, req, ins).map((a) => a.id)
check('a Python review picks the Python reviewer', pick(reviewer, 'Please review my python code for bugs').includes('python-reviewer'))
check('a TypeScript review picks the TypeScript reviewer', pick(reviewer, 'review this typescript module').includes('typescript-reviewer'))
check('a Go build failure picks the Go build resolver', pick(builder, 'my go build is failing with an error').includes('go-build-resolver'))
check('at most MAX_ROLES_PER_REPLY members are picked', pick(reviewer, 'review python typescript go rust code').length <= MAX_ROLES_PER_REPLY)
check('a documentation question picks docs-lookup', pick(research, 'what does the official docs say about this API').includes('docs-lookup'))

console.log('4. Custom instructions count too')
check('the job can pick a member the request does not name', pick(builder, 'help me with this', 'You look after our Rust services and their build').includes('rust-build-resolver'))
check('the request outweighs the job for the same family', pick(reviewer, 'review this python file', 'we ship typescript').includes('python-reviewer'))

console.log('5. Fallback')
const lead = research.members[0]
const none = pick(research, 'zzz qqq')
check('a request that matches nothing gets the lead alone', none.length === 1 && none[0] === lead, none.join(', '))
check('an empty request still gets a member', pick(workflowOrResearch(), '').length === 1)
function workflowOrResearch() { return familyById('workflow')! }

console.log('6. Method text')
const out = await roleText(reviewer, 'review my python code', 'we ship a web app')
check('the text names the family', out.text.startsWith('Working method, from the Reviewer role'))
check('the text names the members it drew on', out.picked.includes('python-reviewer') && out.text.includes('### python-reviewer'))
check('the text carries the ECC method of the member', out.text.includes(ECC_AGENTS.find((a) => a.id === 'python-reviewer')!.prompt.slice(0, 80)))
check('the prompts are not in the metadata module', !JSON.stringify(ECC_AGENT_META).includes('Prompt Defense Baseline'))
check('the text is capped', out.text.length <= MAX_ROLE_TEXT + 200, `${out.text.length}`)
const big = await roleText(builder, 'build error in go rust python typescript react swift code', 'lots of build work')
check('a wide request still stays under the cap', big.text.length <= MAX_ROLE_TEXT + 200, `${big.text.length}`)
check('an empty family yields no text', (await roleText({ ...research, members: [] }, 'anything')).text === '')

console.log('7. Legacy and resolution')
check('an ECC agent id resolves to its family', familyOfAgent('planner')?.id === 'workflow')
check('a stored family id resolves to itself', familyForRole({ id: 'builder' })?.id === 'builder')
check('a legacy role resolves', familyForRole({ id: 'code-reviewer' })?.id === 'reviewer')
check('an unknown role resolves to nothing', familyForRole({ id: 'nope' }) === undefined)
check('no role at all resolves to nothing', familyForRole(undefined) === undefined)

console.log(failed === 0 ? `\nALL PASS: ${passed} passed, 0 failed` : `\n${failed} FAILED, ${passed} passed`)
process.exit(failed === 0 ? 0 : 1)
