// Artifacts and composer triggers: preview documents, titles, and caret triggers.
import { previewDocument, isRunnable, titleFor } from '../src/lib/artifacts/preview'
import { triggerAt, replaceTrigger } from '../src/components/input/trigger'

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = '') {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

// Runnable languages
check('html runnable', isRunnable('html'))
check('jsx runnable', isRunnable('JSX'))
check('python not runnable', !isRunnable('python'))

const html = previewDocument('html', '<h1>Hi</h1>')
check('html wraps fragment', !!html && html.includes('<h1>Hi</h1>') && html.includes('<!doctype html>'))
const full = previewDocument('html', '<!doctype html><html><body>x</body></html>')
check('full html kept as-is', full === '<!doctype html><html><body>x</body></html>')
check('python has no preview', previewDocument('python', 'print(1)') === null)

const js = previewDocument('js', 'console.log("a</script>b")')
check('js escapes closing script', !!js && !js.includes('"a</script>b"') && js.includes('<\\/script'))

const react = previewDocument('tsx', 'export default function Counter(){ return <div>1</div> }')
check('react uses babel', !!react && react.includes('text/babel') && react.includes('const __App = function Counter'))
const react2 = previewDocument('jsx', 'function Card(){ return <p/> }\n')
check('react named component found', !!react2 && react2.includes('var App = Card'), react2?.slice(-400))

// Titles
check('html title', titleFor('html', '<title>My Page</title>') === 'My Page')
check('react title', titleFor('tsx', 'export default function Counter(){}') === 'Counter component')

// Triggers at the caret
const t1 = triggerAt('/sk', 3)
check('slash at start', t1?.kind === 'skill' && t1.query === 'sk' && t1.start === 0)
const t2 = triggerAt('please use @gi', 14)
check('at mid text', t2?.kind === 'source' && t2.query === 'gi' && t2.start === 11, JSON.stringify(t2))
check('url is not a trigger', triggerAt('see https://x.dev', 17) === null)
check('email is not a trigger', triggerAt('mail me@host', 12) === null)
check('caret inside word', triggerAt('hello world', 5) === null)
check('space ends trigger', triggerAt('@git hub', 8) === null)
const pick = replaceTrigger('ask @gi about it', { start: 4, end: 7 }, '@github ')
check('replace keeps rest', pick === 'ask @github  about it', pick)

console.log(`artifacts-test: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
