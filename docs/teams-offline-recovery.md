# Teams offline recovery tools (unreleased development checkpoint)

These source-tree tools initialize encrypted host storage and inspect/restore
recovery packages. They do **not** start a Team, enable sharing, open a port,
create members, install a service or migrate private local chats/Boards. They
require the repository's Node/tsx development environment. They are not yet
included as a packaged desktop/production CLI.

## Before use

- Stop all writers. Use trusted existing private local parent directories, not
  network volumes or attacker-controlled/symlink paths. New destinations must
  not already exist. POSIX owner-only file modes are checked for host root,
  keyring and source journal; Windows/native behavior is not certified.
- Generate a strong, unique passphrase using a trusted password manager. The
  minimum 12-byte input check is **not** an entropy/security guarantee.
- Pipe exactly one passphrase (12–1024 bytes, optional final LF/CRLF) from your
  trusted secret producer into each command below. Interactive/echoed TTY stdin
  is refused. Do not put secrets in arguments, environment variables, shell
  history, repository files or screenshots. The examples omit the producer
  deliberately; no password-manager integration is implied.
- Preserve the encrypted `host.keys` file separately from the data backup, and
  keep its passphrase separately protected. **The package does not contain keys
  or the passphrase. Losing either can make recovery impossible.** Copying both
  to the same location reduces the benefit of separation.

## Commands

Prefix each command with your trusted secret producer's stdout pipeline.
Paths and team IDs below are placeholders, not existing resources:

```sh
npm run teams-offline --workspace backend -- init /trusted/new-host team-id
npm run teams-offline --workspace backend -- backup /trusted/new-host /backup/new-package.reteam
npm run teams-offline --workspace backend -- verify /trusted/new-host /backup/new-package.reteam
npm run teams-offline --workspace backend -- restore /trusted/new-host /backup/new-package.reteam /trusted/new-restored-data
npm run teams-offline --workspace backend -- verify-restore /trusted/new-host /trusted/new-restored-data
```

`init` creates a new owner-only root, encrypted `host.keys`, empty journal and
object store. It never overwrites/reinitializes an existing destination. The
keyring wraps independently generated journal/object/backup keys with
AES-256-GCM using a scrypt-derived key (N=32768, r=8, p=1, 16-byte random salt,
12-byte random nonce). Team identity and fixed KDF metadata are authenticated;
unknown KDFs are rejected, not executed with attacker-selected resource costs.
This is passphrase protection, not an OS keychain, hardware-backed key storage,
host-blind E2EE or a security certification. The authorized host can read data.

`backup` requires existing intact storage, takes the journal's exclusive writer
lock, exports a typed full-storage package, validates it and durably publishes a
new owner-only file without replacement. It never truncates a torn source tail
or creates a missing source journal/object store. It includes all committed
objects, even unreferenced originals: do not assume a deleted card's original
is absent. Private local resources and separate client outboxes are not included.

`verify` authenticates/decrypts the package with the protected keyring, checks
history/attachment references and replays typed state/snapshots without writing
a restore destination. `restore` performs the same checks before creating a
new data directory. It does not overwrite, merge, copy keys or activate data.
`verify-restore` validates the authenticated READY marker and exact restored
inventory offline. The keyring remains at the original key root. Recovery of
that root from your separately preserved `host.keys`, relocation into an active
host layout, passphrase/key rotation and client-outbox recovery are not automated.
The current `backup` command targets the initialized host layout, not a separate
key-root/data-root pair.

Success prints JSON with command, team identity and checkpoint where applicable;
no raw keys or passphrase are printed. Failures have nonzero exit status and
sanitized messages, not arbitrary parser/crypto/OS contents or supplied arguments.
Do not treat command output alone as an off-device backup: verify the saved file,
copy it safely and periodically test a separate-destination restore.

## Interrupted operations

Never discard the only keyring/data copy in order to retry. New-root initialization
or publication failures may leave valid encrypted files or pending ciphertext.
Preserve them for offline inspection. Interrupted restores are not usable without
a verified authenticated `READY`; the `INCOMPLETE` provenance file intentionally
remains even after successful completion. Retry restores into a **different new
path**, never the incomplete one.

A killed writer leaves `writer.lock`. These commands will not steal it. Verify
that all writers are stopped, preserve a full copy, and follow the offline lock
recovery procedure in `docs/design/teams-roadmap.md`. Damaged complete records,
unknown schemas or typed conflicts require investigation, not clearing history.
There is no automatic repair/destructive reset command here.

## Limits and verification

Whole logs/objects/packages are processed in memory. Resource limits/streaming,
full fault injection, hardware power-loss behavior, Windows/native testing,
external anti-rollback checkpoints, passphrase rotation, unattended startup and
OS-keystore integration remain unfinished. JavaScript/native crypto may retain
copies in memory despite best-effort buffer clearing. Offline guessing of a
stolen keyring is possible; use a genuinely strong passphrase.

`npm run teams-test --workspace backend` runs the offline suites, including
wrong-password/tamper/KDF checks, owner-only/no-overwrite operations, CLI tests,
source-damage preservation, typed backup/replay, lost-ACK retries and process-kill
recovery. No network/provider calls are required or made by these tests.
