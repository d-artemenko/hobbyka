# hchat CLI contract

- `activate --display-name NAME --handle @HANDLE --position POSITION --device NAME`: under a cross-process session lock, persist a pending device token, consume the matching VPN activation grant, and retry or correct pending identity/device on the same HTTPS server without changing token or CA.
- `enroll --server URL --code CODE --device NAME [--ca-file PATH]`: recovery flow; consume a 15-minute code and store the device token.
- `whoami`: return the authenticated user and device.
- `users [query]`: list active and disabled handles.
- `dialogs` / `inbox`: list authorized conversations and unread counts.
- `read ID [--after N] [--limit N]`: read ordered messages.
- `search ID QUERY`: search the body text inside one conversation.
- `upload PATH`: scan a file up to 100 MiB and return an attachment ID.
- `send ID|@handle --stdin [--reply-to ID] [--attachment ID] [--no-reply] [--idempotency-key UUID]`: send Markdown or attachments. `--no-reply` still delivers and wakes the recipient, but marks the message as terminal so its Inbox completes silently.
- `group create --name NAME [--member @handle]`, `group add ID @handle`, `group remove ID @handle`, `group transfer ID @handle`.
- `ack ID SEQUENCE`: advance the user's read cursor.
- `watch [--timeout 10m]`: emit server-sent events as JSON Lines.
- `profile get @handle`, `profile set @handle --stdin`, `profile due`: read or update the owner's server-side private contact profiles and list due reviews.
- `request start @handle --stdin [--parent-request ID] [--idempotency-key UUID]`, `request reply ID --stdin [--idempotency-key UUID]`, `request status ID working|input-required|answered`, `request updates`, `request seen ID MESSAGE_ID`, `request done ID`, `request list`: operate durable task-bound agent requests. Without an explicit key, start/reply keep only a semantic SHA-256 fingerprint, UUID and timestamp in a mode-`0600` 24-hour pending journal, retry once, and reuse that UUID when the same command is rerun after an uncertain response.
- `processing claim MESSAGE_ID`, `processing release MESSAGE_ID`, `processing complete MESSAGE_ID`: atomically own a non-Inbox message in the current `CODEX_THREAD_ID`; Inbox uses bridge ownership instead.
- `hook session-start|post-tool-use --thread THREAD_ID`: emit Codex hook-protocol JSON or no output. Reserved for bundled fail-open hooks.
- `bridge route`: show the persistent user/device/task binding.
- `bridge bind --target-thread THREAD_ID`: create the first binding.
- `bridge rebind --from-thread OLD_ID --target-thread NEW_ID`: explicitly move
  an idle route; ever-submitted incomplete work blocks a target change. Passing
  the same ID twice safely transfers that unchanged target to a replacement
  authenticated device.
- `bridge claim`: lease the oldest durable automatic delivery for the bound task.
- `bridge wait`: hold one server long poll until the oldest delivery is claimable.
- `bridge submitted MESSAGE_ID`: record the start of its Codex turn.
- `bridge complete MESSAGE_ID`: complete a handled delivery.
- `router install|start|stop|status|uninstall`: manage the macOS event-driven
  receiver. `router run` is reserved for its LaunchAgent.
- `logout`: delete only the local session file.

Messages are limited to 32 KiB. A message accepts at most five clean attachments and 200 MiB total. Exit code `0` means the server accepted the operation; all other codes include a JSON error on stderr.
