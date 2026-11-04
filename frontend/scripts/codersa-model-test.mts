/**
 * Codersa's model routing: which providers it can drive, and which
 * OpenAI-compatible base each one is sent to.
 *
 *   npm run codersa-model-test --workspace frontend
 */
import { openAiBaseFor } from '../src/lib/codersa/model'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`FAIL  ${name} ${detail}`) }
}

console.log('\n[1] Gemini is sent to its OpenAI-compatible route')
check('the native v1beta base gains /openai', openAiBaseFor('gemini', 'https://generativelanguage.googleapis.com/v1beta') === 'https://generativelanguage.googleapis.com/v1beta/openai')
check('a base that already has /openai is left alone', openAiBaseFor('gemini', 'https://generativelanguage.googleapis.com/v1beta/openai') === 'https://generativelanguage.googleapis.com/v1beta/openai')

console.log('\n[2] Ollama is sent to /v1, the local OpenAI-compatible route')
check('the server root gains /v1', openAiBaseFor('ollama', 'http://localhost:11434') === 'http://localhost:11434/v1')
check('a base already ending in /v1 is left alone', openAiBaseFor('ollama', 'http://localhost:11434/v1') === 'http://localhost:11434/v1')

console.log('\n[3] OpenAI-style providers are unchanged')
check('openai keeps its base', openAiBaseFor('openai', 'https://api.openai.com/v1') === 'https://api.openai.com/v1')
check('trailing slashes are trimmed', openAiBaseFor('openai', 'https://api.openai.com/v1///') === 'https://api.openai.com/v1')

console.log(`\n${failed ? 'FAILED' : 'ALL PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
