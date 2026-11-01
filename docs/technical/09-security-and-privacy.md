# 9. Security and privacy

This chapter describes what protects your data, what the app promises, and where
those promises stop. The threat model is written in the code headers. Read them
too, because they are the most detailed statement of intent.

## The principles

1. **Local first.** Chats, library and connector data stay on the machine. Only
   the model call, and any service or connector you explicitly use, leave it.
2. **No hidden sends.** The app does not post feedback, analytics or chat content
   to a service you have not set up. Feedback is stored locally.
3. **Keys are encrypted and sent only when needed.** See the vault below.
4. **Destructive actions ask first.** Writes outside the project, risky commands,
   clones and voice cloning all wait for your confirmation.
5. **Failures are honest.** When a check cannot run, the answer is "unchecked", not
   "clean". The VirusTotal integration, the sandbox probe and the service adapters
   all work this way.

## Provider keys: the vault

Covered in [data and persistence](08-data-and-persistence.md#the-vault).

The short version: PBKDF2 (150,000 iterations) derives an AES-GCM key from your
passphrase. The passphrase is never stored. Keys are decrypted in the browser and
sent with each request to the backend, which passes them on and forgets them.

`backend/src/routes/secrets.ts` masks secrets in responses (`maskSecrets`), so a
key cannot show up in a diagnostic or an error.

## The startup lock

`frontend/src/lib/security/lock.ts`. A lock screen can be placed in front of the
app. It has three codes, and they are not three levels of the same thing:

| Code | Behaviour |
|---|---|
| **main** | Unlocks your data. |
| **duress** | Looks like it worked. It deletes the data, so a person who forces you to unlock gets nothing. It is covert by design. |
| **guest** | Opens a separate, empty namespace (`re.data.guest`). The Shell shows a strip so you know the session is a guest session. |

Codes are stored as hashes. The duress wipe calls `POST /api/data/wipe` on the
server as well. That route is unauthenticated, which is acceptable only because the
server binds to loopback by default. If you expose the server to a network, the
wipe route becomes a remote destructive endpoint. Do not do that without adding
authentication.

Two-factor (TOTP) is in `lib/security/totp.ts`: SHA-1, six digits, 30-second
period, the common default for authenticator apps. The code entry uses HeroUI's
`InputOTP`. `lib/security/apiKeyAuth.ts` is an optional authenticator lock on the
API-key vault: unlocking needs the passphrase and a 6-digit code. The TOTP secret
is itself encrypted with the passphrase, so the code cannot be checked without it.

## Privacy Shield

`frontend/src/lib/privacy/shield.ts` has three modes:

| Mode | Behaviour |
|---|---|
| **No Privacy** | No scanning. Requests go out as composed. |
| **Privated** (default) | Scans interactions and redacts keys and secrets from anything that leaves the device. |
| **Top Secret** | Scans every interaction. Only your selected chat provider may be contacted. Web search, article images and all other outbound traffic are blocked. |

`runChat` checks the mode before any retrieval (`prepareRag`), and web search is
offline-first in Top Secret mode.

## Agent access

The coding agent works inside a folder you choose. Three modes: `project` (the
open project only, the default), `selected` (the project plus folders you name),
and `full` (the whole computer). The mode is enforced on the server in
`backend/src/services/agent-access.ts`. The client's choice is a request, not the
rule.

## Commands

The server's command runner (`routes/ide.ts`) has a denylist of commands it never
runs, a confirm list that needs your approval, a confined working directory, a
scrubbed environment, timeouts, and output caps. A confirmation from the UI is
required for anything on the confirm list. Confirmation uses the app's own
dialog, not `window.confirm`, because `window.confirm` does not appear in the
desktop app.

## Downloads and clones

Before the agent starts a download, the URL is checked against VirusTotal. After
the bytes arrive, the SHA-256 is checked. A clone needs a permission checkbox, and
the agent has no clone tool at all. Every download is recorded in the ledger.

## Updates

The updater (`backend/src/update/`) checks each archive against `SHA256SUMS` from
the release tag. That proves the archive is the one published under that tag. It is
an integrity check, not a signature, so it does not protect against a compromised
release. It also refuses writes outside the app root and inside the data directory
(`guard()` in `service.ts`). A failed boot rolls back.

## Skills and packs

Imported skills are scanned by `lib/security/trojan.ts` before they are enabled.
Community packs are vendored with their upstream licences. A scan is not a
guarantee; read a pack before you trust it with a connector.

## Services and connectors

- Services (OpenSEO, VoiceStudio, Twenty, Postiz) get only what their feature
  needs. Postiz creates drafts only. Nothing is published or scheduled.
- Voice cloning requires an explicit permission flag, and the server refuses
  without it.
- Connector credentials travel per request in the `x-re-integrations` header. The
  Composio key is encrypted in the browser.

## Where the promises stop

- The model provider sees whatever you send it. Choose a local model (Ollama, LM
  Studio) if that matters to you.
- The embedded page viewer fetches pages through the server. The server sees the URL.
- The desktop build checks update archives by checksum, not by signature.
- The wipe route is unauthenticated (see above). Keep the server on loopback.

## Reporting a vulnerability

Do not open a public issue for a security problem. Contact the maintainer
privately through the repository's security settings.
