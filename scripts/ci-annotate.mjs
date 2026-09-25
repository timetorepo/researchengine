#!/usr/bin/env node
// Turn the tail of a CI log file into a GitHub Actions annotation.
//
// Why: job logs are served from results-receiver.actions.githubusercontent.com,
// which some build environments cannot reach. Annotations ARE reachable through
// the checks API, so a failing step tees its output to a file and this script
// republishes the interesting part — the actual compiler/bundler error — where
// it can be read with:
//
//   gh api /repos/<owner>/<repo>/commits/<sha>/check-runs \
//     --jq '.check_runs[].output.annotations[] | select(.annotation_level=="failure") | .message'
//
// Usage: node scripts/ci-annotate.mjs <logfile> <title> [maxChars]
import { readFileSync } from 'node:fs'

const [file, title = 'step failed', maxChars = '6000'] = process.argv.slice(2)
if (!file) {
  console.error('usage: node scripts/ci-annotate.mjs <logfile> <title> [maxChars]')
  process.exit(2)
}

let text
try {
  text = readFileSync(file, 'utf8')
} catch (e) {
  text = `(no log file "${file}": ${e.message})`
}

// Keep the end (where the error is) but drop the noisiest progress lines.
const lines = text.replace(/\r/g, '').split('\n')
const interesting = lines.filter((l) => !/^\s*$/.test(l) && !/^\s*\[?\d+\/\d+\]/.test(l))
const tail = interesting.slice(-120).join('\n').slice(-Number(maxChars) || -6000)

// GitHub escapes the message body: % → %25, newline → %0A.
const esc = (s) => String(s).replace(/%/g, '%25').replace(/\n/g, '%0A').replace(/\r/g, '')

console.log(`::error title=${esc(title)}::${esc(tail)}`)
console.log(`— ${lines.length} lines captured from ${file}; full log on the run page.`)
