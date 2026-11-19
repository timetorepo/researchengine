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
host layout, passphrase/storage-key rotation and client-outbox recovery are not automated; trusted-local Owner bearer recovery is described below.
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

## Trusted-local Owner credential recovery and restore activation

For an **already bootstrapped** host, source-tree tooling now supports all-session
credential recovery. It cannot create an Owner implicitly in legacy content-only
history or rescue a lost keyring/passphrase. The offline `init` command still
creates storage only; first Owner bootstrap is currently a trusted-local library
action, not a shipped sign-in UI or CLI onboarding flow.

Stop every writer and preserve a backup first. Obtain the exact current checkpoint
(sequence and full digest) from the verified backup/restore output. Confirm the
recorded Owner ID and that **every existing session must be invalidated**, not
just the Owner's session. Pipe the keyring passphrase from your trusted secret
producer into this command (all other arguments are nonsecret placeholders):

```sh
npm run teams-offline --workspace backend -- recover-owner KEY_ROOT DATA_ROOT OWNER_ID EXPECTED_SEQUENCE EXPECTED_DIGEST NEW_ENCRYPTED_CREDENTIAL_FILE --confirm-invalidate-all
```

The output file's parent must be owner-only and already exist. An existing output
file, wrong Owner, stale/mismatched checkpoint, invalid keyring or absent explicit
confirmation is rejected. A successful command appends one durable recovery
record, preserving membership roles and shared content while revoking **all**
prior sessions. Only one new Owner session remains active. The one-hour credential
is written in a new owner-only artifact encrypted using the supplied passphrase,
a fresh salt and a distinct authenticated context. Neither the raw credential
nor passphrase appears in stdout, argv or environment. Protect the artifact;
its passphrase holder can decrypt an Owner credential. There is no default
plaintext-dump command. Secure client import/delivery is not yet integrated;
`unlockOwnerCredential` is the trusted in-process source-tree API, not a UI login.

A recovered bearer is not a rotated storage key or changed keyring passphrase.
Data/keyring encryption-key rotation, passphrase rewrapping, OS keystore and
lost-passphrase recovery remain unfinished. This is host-trusted administration:
a process holding the unwrapped storage key has full local authority. Never
expose `recoverOwner`/`recoverOfflineOwner` as an ordinary bearer/network request.

### Restored data stays gated

Normal host opening now detects supported restore provenance (`READY` and
`INCOMPLETE`) and refuses incomplete or unactivated restores. A completed restore
must authenticate its marker with the backup key, verify the recorded journal
prefix/object inventory, and have an exact-next durable `restore-activation`
recovery record bound to that marker's digest. The recovery command supplies
these checks and invalidates old sessions before returning a new credential.
Subsequent source-library host opens must continue supplying the backup key for
marker verification. The command does **not** start a listener or join a Team.

A backup made after one activation does not authorize the next restored copy:
the new restore marker/checkpoint requires another fresh invalidation. An older
whole backup's previously valid credentials cannot pass this supported activation
flow. This is not global rollback detection: the host/filesystem remain trusted,
and out-of-band copying/removing provenance or reverting an entire active host
without restore markers requires an independently trusted checkpoint/instance
registry to detect. Other running copies cannot be revoked by an offline restore;
stop the original host before activation. No security certification is implied.

`verify-restore` checks the original restored artifact and checkpoint **before**
activation; after recovery appends a record, it intentionally no longer matches
that original checkpoint. Post-activation host opening validates the original
prefix, retained inventory, typed history and activation record. It is not
permission to ignore an invalid original restore.

### If recovery is interrupted

The source history may already have committed all-session invalidation even if
the command reports failure or no artifact was delivered. Preserve any new file
or pending ciphertext. Do not assume old sessions still work, and never delete
history/re-bootstrap to get around this. After confirming all writers are stopped
and following explicit stale-lock recovery if needed, obtain the **new** durable
checkpoint and repeat recovery to a different new artifact path. The previous
undelivered session is also invalidated. There is no multi-file transaction
across journal commit and credential-artifact publication. Tests simulate a lost
response after a durable commit; exhaustive power-loss/fault injection across
these boundaries and native/device testing remain unperformed.
