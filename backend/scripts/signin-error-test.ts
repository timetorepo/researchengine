// The provider's error address moves a sign-in to 'failed' with a reason, and a late error
// cannot undo a connected or returned attempt in the wrong order.
import { getSignIn, moveSignIn, startSignIn } from '../src/services/signin'

let failed = 0
const check = (name: string, ok: boolean) => { console.log(`${ok ? '  ok' : 'FAIL'}  ${name}`); if (!ok) failed++ }

const a = startSignIn('errortest-aaaaaaaa', 'pipedream', 'https://connect.pipedream.com/x')
check('a sign-in starts open', a?.state === 'open')
check('an open sign-in can fail with a provider reason', moveSignIn('errortest-aaaaaaaa', 'failed', Date.now(), 'provider_error')?.reason === 'provider_error')
check('the reason is kept on the record', getSignIn('errortest-aaaaaaaa')?.reason === 'provider_error')

const b = startSignIn('errortest-bbbbbbbb', 'pipedream', 'https://connect.pipedream.com/y')
moveSignIn('errortest-bbbbbbbb', 'returned')
moveSignIn('errortest-bbbbbbbb', 'connected')
check('a late error cannot undo a connected sign-in', moveSignIn('errortest-bbbbbbbb', 'failed', Date.now(), 'provider_error') === null)
check('and the record still says connected', getSignIn('errortest-bbbbbbbb')?.state === 'connected' && !getSignIn('errortest-bbbbbbbb')?.reason)
void b

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`)
process.exit(failed === 0 ? 0 : 1)
