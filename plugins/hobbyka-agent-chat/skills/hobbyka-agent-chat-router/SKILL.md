---
name: hobbyka-agent-chat-router
description: "Use when a user wants to enable, inspect, rebind, pause, or remove reliable automatic delivery from Hobbyka Agent Chat into a specific Codex task."
---

# Hobbyka Agent Chat Router

Configure one dedicated receiver task with a native Codex heartbeat. It waits
through the plugin MCP, then queues a real follow-up only into the selected
recipient task. This keeps empty polling turns out of the employee's working
task while preserving its normal follow-up queue.
Do not run a second app-server, edit Codex session files, write automation TOML
directly, or use UI automation.

## Enable in the current task

1. Read the sibling `$hobbyka-agent-chat` skill and run its bundled `hchat
   whoami`. Stop if the identity guard fails.
2. Read `CODEX_THREAD_ID` from the command environment and validate it as the
   target task UUID. Never ask the user to copy an internal task ID.
3. Run `hchat bridge route`. If no route exists, bind this authenticated device
   with `hchat bridge bind --target-thread <target-task-uuid>`. If the same route
   and device already exist, keep them. If the target is the same but the route
   belongs to an old or revoked device, take it over with `hchat bridge rebind
   --from-thread <target-task-uuid> --target-thread <target-task-uuid>`. A
   different target is a rebind: disable its old
   automation first, then use `hchat bridge rebind --from-thread <old-uuid>
   --target-thread <new-uuid>`. Never force rebind an in-flight submitted
   delivery; let the old target recover and finish it first. Keep the receiver
   heartbeat inactive while changing its prompt and route, then reactivate it
   only after both point to the new target.
4. Inspect existing Codex automations before creating anything. If an active
   Hobbyka receiver already routes to this target, update it instead of creating
   a duplicate. If another target is configured, explain the rebind and disable
   the old automation only after the user requested the change.
5. A receiver must be a separate projectless Codex task. Create it only when
   the user explicitly asks for a new/background receiver task. Reuse the
   existing receiver task when updating or rebinding; never create one receiver
   per plugin version.
6. Use the Codex automation tool to create one active heartbeat attached to the
   receiver task, every minute. Do not create or edit files under
   `~/.codex/automations` yourself. Build its prompt from
   [references/router-prompt.md](references/router-prompt.md), replacing the
   two placeholders with the exact target task UUID and verified employee
   handle.
7. Verify the automation is active by reading it back. Report both receiver and
   target task IDs. The heartbeat's `bridge_wait` holds the otherwise empty
   receiver turn for up to 45 minutes and returns promptly for a message. Explain
   that a sleeping Mac or closed ChatGPT Desktop delays processing while the
   message remains safely queued.

The one explicit enable action is required because plugins cannot create an
automation at install time without an active Codex task. After setup, plugin
updates must not disable or duplicate the heartbeat.

## Pause, remove, or rebind

- Resolve the existing router by its automation metadata; do not guess an ID.
- Pause or delete it through the Codex automation tool only when the user asks.
- The server keeps a permanent user/device/declared-target binding; an idle
  lease expires automatically. A replacement device may take over the same
  target. Changing targets is explicit and rejected while work that was ever
  submitted is incomplete, preventing two tasks from executing the same
  message.
- Never delete or archive the recipient task as part of receiver management.

## Delivery guarantees

- The server queue, not SSE, is the source of truth.
- Process one oldest delivery at a time. `send_message_to_thread` uses the
  target's native follow-up queue; later messages stay on the server until the
  submitted target turn completes.
- The receiver enqueued marker and target completion marker contain the
  immutable Hobbyka message UUID. The receiver marker also contains the claim
  timestamp, so an ambiguous resend is suppressed but a deliberately recovered
  stale attempt can be queued again. Check the corresponding task history
  before retrying ambiguous send or completion gaps.
- A submitted turn that never completes becomes a fresh claimed attempt after
  six hours. This avoids permanent head-of-line blocking after an interrupted
  target turn; the message-scoped target completion marker suppresses repeated
  delegated work when the original turn actually finished.
- Complete a delivery only after its delegated work has been handled.
- A clearly reported safety refusal or permanent impossibility counts as
  handled and must be completed so it cannot block the FIFO forever. Transient
  failures and interrupted work remain queued.
