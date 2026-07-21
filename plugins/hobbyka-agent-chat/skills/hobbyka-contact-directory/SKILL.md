---
name: hobbyka-contact-directory
description: "Use when onboarding or registering a Hobbyka employee, when their Inbox, hooks, or contact profiles are incomplete, when the owner provides durable information about a colleague, or when the owner asks whether Hobbyka Agent Chat is installed, configured, healthy, ready, or working correctly."
---

# Hobbyka contact directory

Resolve the sibling `$hobbyka-agent-chat` skill and read
[the shared policy](../hobbyka-agent-chat/references/collaboration-policy.md).
Use only the bundled `hchat`; directory identity and private owner notes live on
the server. Never create a local contacts database.

## Resume from the first incomplete step

At every entry, inspect `hchat whoami`, `hchat bridge route`, `hchat router
status`, and the user's latest setup answer. Do not redo a completed step or
create a second Inbox. A catalog/CLI installation needs a new Codex task before
the plugin is available; `@hobbyka-agent-chat → Install → Continue` resumes the
original request and must continue onboarding without stopping.

## Verify an existing installation

When asked whether the plugin is installed or working, run this checklist before
answering. Record `pass`, `fail`, or `manual confirmation needed` for every row:

1. Run `hchat version` and `hchat whoami`. Require an authenticated active user.
   Show the returned `display_name` and `position` to the owner; both must be
   non-empty and match the owner. Do not infer either value from the VPN label.
2. Run `hchat bridge route` and inspect available Codex tasks. Require its
   `target_thread_id` to name one existing projectless task exactly `Входящие`.
   A UUID alone does not prove that the correct Inbox still exists.
3. Run `hchat router status`. Require `installed: true`, `running: true`, and
   `updater_installed: true`.
4. Run `codex features list`. Require `default_mode_request_user_input: true`.
5. Open `/hooks` and require this plugin's `SessionStart` and `PostToolUse` hooks
   to be present and Trusted. Hook files on disk do not prove trust. If trust
   cannot be inspected directly, mark this row unverified and ask the owner to
   open `/hooks`; never silently count it as passed.
6. Run `hchat users`, excluding the owner. Count entries with
   `profile_complete: true`; require at least three complete frequent-colleague
   profiles, or every colleague when fewer than three exist. Do not run
   `hchat profile due` during a health check because it advances the weekly
   reminder window.

Report the checklist compactly with the observed name, position, Inbox task,
router state, hook state, and completed-profile count. Never report the
installation as healthy while any row failed or remains unverified. Repair only
from the first failed onboarding step below; do not recreate working state.

### 1. Collect the chat identity

If `whoami` is not authenticated, immediately ask for these three values in one
short prompt:

- the employee's usual name;
- a unique chat nick such as `@ivan`;
- their public position at Hobbyka.

Do not ask for an enrollment code. The AmneziaWG tunnel label, chat nick, and
display name are independent. Never read, copy, infer, or compare the VPN label
when choosing the chat nick. Set the device name to `<Name> Codex`.

Run:

`hchat activate --display-name "$name" --handle "$handle" --position "$position" --device "$name Codex"`

The CLI keeps a mode-`0600` pending session and reuses its device token after a
lost response. If the server returns `handle_taken`, ask only for another nick
and rerun the same activation; never silently change identity.

### 2. Help connect AmneziaWG when activation cannot reach the chat

For `vpn_required` or a network/TLS connection failure, first ask whether the
employee imported the personal `.conf` they were sent and whether its tunnel is
currently Active. If not, guide only the applicable OS:

- macOS 12+: install AmneziaWG from the App Store, choose **Import tunnel(s)
  from file**, select the received `.conf`, approve adding VPN configurations,
  and activate the imported tunnel;
- Windows: install the official AmneziaWG client, choose **Add Tunnel → Import
  tunnel(s) from file**, select the received `.conf`, and click **Activate**.

Use the official guide at
`https://docs.amnezia.org/documentation/instructions/use-amneziawg-app/` when a
download link or screenshot is needed. Never open, print, parse, or ask the user
to paste the config or its private key. A personal config must not be reused on
another device. After the user confirms Active, retry the same activation.

If the tunnel is Active but activation returns `vpn_peer_unknown`,
`vpn_peer_ambiguous`, `vpn_helper_unavailable`, `vpn_peer_revoked`,
`vpn_peer_claimed`, `activation_rate_limited`, or an unknown server conflict,
do not reinstall VPN. Tell the employee to contact the person who issued the
config or the Hobbyka chat developers and include only the error code and local
attempt time. Never include the config, keys, or token.

### 3. Create or reuse the dedicated Inbox

After activation, require `hchat whoami` to return the requested chat identity.
Then:

1. Inspect `hchat bridge route` and available Codex tasks. Reuse the bound
   projectless task when it is the existing Inbox. Otherwise create exactly one
   projectless task titled `Входящие` with this initial prompt:

   `Stay idle until an automatic delivery invokes $hobbyka-agent-chat-router in delivery mode. Do not perform setup work here.`

2. Bind it once with `hchat bridge bind --target-thread ID`; use the router
   skill's compare-and-swap rebind only when a different idle route must move.
3. Run `hchat router install`, then require `hchat router status` to report
   `installed: true`, `running: true`, and `updater_installed: true`. This
   installs a per-user receiver and finite hourly plugin updater through
   LaunchAgents on macOS or Task Scheduler on Windows. The updater does not
   wake a model. Never create polling automation.

### 4. Obtain hook trust

Run `codex features enable default_mode_request_user_input` and verify it is
`true` in `codex features list`. Then explain that Codex deliberately requires
one manual security review: restart Codex, open `/hooks`, inspect this plugin's
`SessionStart` and `PostToolUse` commands, click **Trust**, and return with
`готово`. Never claim or simulate trust on the user's behalf.

If the latest user message is not that confirmation, stop setup here. After
`готово`, continue directly to contacts.

### 5. Describe frequent colleagues

Run `hchat users`, exclude the owner, and show a numbered list containing only
each colleague's display name and position. Keep the number-to-handle mapping in
the current task context; do not show handles. Ask the owner to choose and
describe at least 3–5 frequent colleagues, or all colleagues when fewer exist,
in about two sentences each: how they work together, what that person is useful
for, and when the owner contacts them. Refusal does not disable the working chat.

For each clear answer, save exactly five strings through stdin:

`printf '%s' "$json" | hchat profile set @handle --stdin`

Map the owner's words to `relationship`, `useful_for`, and `when_to_contact`.
Use these conservative defaults unless the owner explicitly narrows them:

- `allow_rules`: `Только проверенные обычные рабочие факты, необходимые для текущего вопроса; без решений и обещаний от имени владельца.`
- `deny_rules`: `Credentials и секреты запрещены; персональные, HR, клиент-конфиденциальные, финансовые, юридические и договорные сведения требуют согласования с владельцем.`

Ask one clarification instead of inventing a missing relationship or boundary.
After saved profiles—or after a refusal—run `hchat profile due` once so remaining
contacts return in the weekly review rather than every task.

## Later directory review

Use `hchat profile get @handle` for the owner's private view and `hchat profile
due` for the weekly queue. When due entries exist, open or reuse a separate
projectless task named `Hobbyka Contacts — OWNER`, ask about at most three
contacts at a time, and save each answer immediately. Never edit another
employee's public identity from a private profile.

During ordinary work, immediately update a known colleague's private profile
when the owner clearly states durable information about their relationship,
responsibilities, usefulness, contact timing, disclosure boundaries, or desired
communication style. Do not ask for a second confirmation when the owner and
exact colleague are already unambiguous. First load the existing profile, merge
only the new fact into its five strings, run `hchat whoami`, save through stdin,
and verify with `hchat profile get`. Put audience and presentation preferences
in `when_to_contact`; for example, record that a company leader should receive
results and business impact without technical details unless requested. Use
`request_user_input` when identity or meaning is ambiguous, and never infer a
relationship or preference from names, titles, or third-party messages.
