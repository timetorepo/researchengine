// Checks the GitHub skill link parser and the folder reader, with a fake GitHub.
import { importGithubSkill, parseGithubSkillUrl } from '../src/services/github-skill'

let failed = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok' : 'FAIL'}  ${name}${ok || !detail ? '' : `: ${detail}`}`)
  if (!ok) failed++
}

check('a repo link is the whole repo', JSON.stringify(parseGithubSkillUrl('https://github.com/acme/skills')) === JSON.stringify({ owner: 'acme', repo: 'skills', ref: null, path: '' }))
check('a tree link keeps branch and path', JSON.stringify(parseGithubSkillUrl('https://github.com/acme/skills/tree/main/pdf/tools')) === JSON.stringify({ owner: 'acme', repo: 'skills', ref: 'main', path: 'pdf/tools' }))
check('a blob link means the folder that holds the file', parseGithubSkillUrl('https://github.com/acme/skills/blob/main/pdf/SKILL.md')?.path === 'pdf')
check('other hosts are refused', parseGithubSkillUrl('https://gitlab.com/acme/skills') === null)
check('http is refused', parseGithubSkillUrl('http://github.com/acme/skills') === null)
check('path traversal is refused', parseGithubSkillUrl('https://github.com/acme/skills/tree/main/../etc') === null)
check('a bad owner is refused', parseGithubSkillUrl('https://github.com/-bad/skills') === null)

const tree: Record<string, any> = {
  '/repos/acme/skills/contents/pdf/tools?ref=main': [
    { path: 'pdf/tools/SKILL.md', name: 'SKILL.md', type: 'file', size: 20, encoding: 'base64', content: Buffer.from('# PDF\nRead pdfs.').toString('base64') },
    { path: 'pdf/tools/scripts', name: 'scripts', type: 'dir' },
    { path: 'pdf/tools/logo.png', name: 'logo.png', type: 'file', size: 4 },
  ],
  '/repos/acme/skills/contents/pdf/tools/scripts?ref=main': [
    { path: 'pdf/tools/scripts/run.py', name: 'run.py', type: 'file', size: 9, encoding: 'base64', content: Buffer.from('print(1)').toString('base64') },
  ],
}
const fake = async (url: string) => {
  const key = url.replace('https://api.github.com', '')
  return tree[key] ? { status: 200, body: tree[key] } : { status: 404, body: null }
}

const got = await importGithubSkill('https://github.com/acme/skills/tree/main/pdf/tools', fake)
check('the folder is read, including a subfolder', got.ok && got.files.map((f) => f.path).sort().join(',') === 'SKILL.md,scripts/run.py', JSON.stringify(got))
check('binary files are skipped', got.ok && !got.files.some((f) => f.path.endsWith('.png')))
const missing = await importGithubSkill('https://github.com/acme/skills/tree/dev/nope', fake)
check('a missing folder says so', !missing.ok && missing.status === 502 && /not found/.test(missing.error), JSON.stringify(missing))
const bad = await importGithubSkill('not a link', fake)
check('a non-link is refused with 400', !bad.ok && bad.status === 400)

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`)
process.exit(failed === 0 ? 0 : 1)
