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
//     --jq '.check_runs[] | .. | select(.annotation_level=="failure") | .message'
//
// Usage: node scripts/ci-annotate.mjs <logfile> <title> [maxChars]
import { readFileSync } from 'node:fs'

const [file, title = 'step failed', maxChars = '8000'] = process.argv.slice(2)
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

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g
// Progress lines that would otherwise fill the tail and hide the error.
const NOISE = new RegExp([
  '^\\s*$',
  '^\\s*\\[?\\d+\\/\\d+\\]',                        // npm/tauri progress
  '^\\s*(Compiling|Checking|Fresh|Building|Downloading|Downloaded|Updating|Adding|Locking|Waiting|Blocking)\\b', // cargo
  '^\\s*(npm (warn|notice)|added \\d+ packages)',
].join('|'))

const lines = text.replace(/\r/g, '').replace(ANSI, '').split('\n')
const interesting = lines.filter((l) => !NOISE.test(l))
const tail = interesting.slice(-150).join('\n').slice(-(Number(maxChars) || 8000))

// GitHub escapes the message body: % → %25, newline → %0A.
const esc = (s) => String(s).replace(/%/g, '%25').replace(/\n/g, '%0A').replace(/\r/g, '')

console.log(`::error title=${esc(title)}::${esc(tail)}`)
console.log(`— ${lines.length} lines read from ${file}; full log on the run page.`)
