# hchat CLI contract

- `enroll --server URL --code CODE --device NAME [--ca-file PATH]`: consume a 15-minute code and store the device token.
- `whoami`: return the authenticated user and device.
- `users [query]`: list active and disabled handles.
- `dialogs` / `inbox`: list authorized conversations and unread counts.
- `read ID [--after N] [--limit N]`: read ordered messages.
- `search ID QUERY`: search the body text inside one conversation.
- `upload PATH`: scan a file up to 100 MiB and return an attachment ID.
- `send ID|@handle --stdin [--reply-to ID] [--attachment ID] [--idempotency-key UUID]`: send Markdown or attachments.
- `group create --name NAME [--member @handle]`, `group add ID @handle`, `group remove ID @handle`, `group transfer ID @handle`.
- `ack ID SEQUENCE`: advance the user's read cursor.
- `watch [--timeout 10m]`: emit server-sent events as JSON Lines.
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
