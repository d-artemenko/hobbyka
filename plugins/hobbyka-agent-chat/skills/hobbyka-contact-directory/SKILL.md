---
name: hobbyka-contact-directory
description: "Activate a pre-issued Hobbyka account over AmneziaWG, finish first-use Codex setup, list employee identities, and maintain the employee-owner's private per-contact profiles. Use when Hobbyka Agent Chat is first installed, activation or Inbox routing is incomplete, a contact is new or underspecified, the weekly contact review is due, or the owner asks to update who to contact and what may be shared."
---

# Hobbyka contact directory

Resolve the sibling `$hobbyka-agent-chat` skill and read
[the shared policy](../hobbyka-agent-chat/references/collaboration-policy.md).
Directory identity and private owner notes are server data; do not keep a
second local contacts database.

## First use

1. Run `codex features enable default_mode_request_user_input`, then verify the
   feature is `true` in `codex features list`. This idempotently permits the
   secretary to ask its owner outside planning mode.
2. Ask for one Codex restart and one review/trust click for this plugin's hooks.
   Plugin installation cannot bypass that product security boundary.
3. After restart, require the employee's personal AmneziaWG profile to be
   connected. Collect display name, unique `@handle`, and public position in
   one `request_user_input`; never request an enrollment code. Derive the
   device label as `DISPLAY_NAME Codex` instead of asking a fourth setup
   question.
4. Activate the pending VPN grant once:

   `hchat activate --display-name "$name" --handle "$handle" --position "$position" --device "$name Codex"`

   VPN source address is the bootstrap proof. Before the request, the CLI
   persists a new revocable device token in a pending `0600` session and reuses
   it if the response is lost; it never prints the token. If the handle is
   already taken, ask the owner for another handle and rerun activation against
   the same server: the CLI updates only pending identity/device fields while
   preserving the token and CA. Never alter identity silently. If activation
   reports no pending grant, stop instead of switching servers or VPN profiles.
5. Run `hchat whoami`, require the new identity, then use
   `$hobbyka-agent-chat-router` to create/bind the dedicated Inbox and install
   its event-driven LaunchAgent. Do not create a polling automation.

SessionStart hook instructions are resumable: perform only the first incomplete
step after restart or reconnect instead of activating or binding twice.

## Directory and private profiles

- Run `hchat users [query]` for the common directory. Never edit another
  employee's public identity from a private profile.
- Run `hchat profile get @handle` for the current owner's view.
- Update through stdin only:

  `printf '%s' "$json" | hchat profile set @handle --stdin`

  Use exactly five string fields: `useful_for`, `relationship`,
  `when_to_contact`, `allow_rules`, and `deny_rules`. The server owns
  completeness and review timestamps.

## Separate weekly review

Run `hchat profile due`. When it returns contacts, open or reuse a dedicated
projectless task named `Hobbyka Contacts — OWNER`; do not interrupt unrelated
work with the review. In that task, ask the owner concise questions for at most
three contacts at a time, covering the five fields above, and save each answer
immediately. New, empty, or insufficient profiles remain due until complete.
Do nothing when the due list is empty. Also perform the same review whenever
the owner explicitly asks to update contacts.
