// Allow an explicitly supplied browser without committing sandbox-specific paths.
// No downloads, sandbox overrides, or personal browser profiles.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('./node_modules/@playwright/mcp/cli.js', import.meta.url))
const browserArgs = process.env.BROWSER_EXECUTABLE
  ? ['--executable-path', process.env.BROWSER_EXECUTABLE]
  : []
const child = spawn(process.execPath, [cli, ...process.argv.slice(2), ...browserArgs], { stdio: 'inherit' })
child.on('error', (error) => { console.error(error.message); process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
