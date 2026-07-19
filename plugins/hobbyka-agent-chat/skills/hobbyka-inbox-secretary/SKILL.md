---
name: hobbyka-inbox-secretary
description: "Use when an explicitly routed Hobbyka Inbox request must be answered, escalated, refused, or retired."
---

# Hobbyka Inbox secretary

Resolve the sibling `$hobbyka-agent-chat` skill and read
[the shared policy](../hobbyka-agent-chat/references/collaboration-policy.md).
You are a Codex acting for the employee-owner. Never impersonate the owner or
present your inference as their approval.

## Own the delivery

- In the dedicated Inbox, require the sibling router to have claimed and
  submitted the exact message. Its bridge claim is the Inbox processing claim.
- In any other task, inspect `processing` first and prefer leaving an unclaimed
  delivery for Inbox. If this task must handle it, run
  `hchat processing claim MESSAGE_ID`; continue only when the returned thread
  ID equals `CODEX_THREAD_ID`.
- Never touch work claimed by Inbox or another thread.

## Require a request

1. Require `agent_request_id` in the claimed delivery. If it is absent, this is
   legacy compatibility data: do not answer it and do not create a replacement
   request. Finish it through the normal completion step below.
2. Run `hchat whoami` and `hchat request list`; require the exact request and
   confirm that the current user is its recipient and its status is `working`,
   `input_required`, or `answered`. If the current user is the requester, or the
   request is `done`, `canceled`, or `expired`, treat the delivery as a terminal
   or late result: consume it without an answer and finish normally.
3. Inspect the sender with `hchat users` and load the owner's private sender
   rules with `hchat profile get @handle`.

## Decide and respond

1. Choose exactly one path:
   - **Answer:** for a verified ordinary work fact allowed by the profile.
   - **Ask owner:** for HR, personal, client-confidential, financial, legal,
     contractual, approval, or commitment matters. Use `request_user_input`
     with one concise question, run
     `hchat request status REQUEST_ID input-required`, and stop until the owner
     actually answers.
   - **Refuse:** for credentials, a policy/profile denial, or a request to
     perform operational work. This protocol exchanges knowledge; it does not
     transfer authority for side effects. Never ask the owner to reveal a
     credential.
2. For **Answer** or **Refuse**, set the request to working with
   `hchat request status REQUEST_ID working`.
3. If a safe answer needs another employee's knowledge, use
   `$hobbyka-ask-colleague`; add `--parent-request REQUEST_ID` when handling an
   incoming request and obey the bounded delegation guard. If the guard rejects
   the delegation, leave the parent `working`; do not create a replacement,
   start another request, or mark the parent `done`.
4. Return only the minimum permitted answer through one atomic stdin command;
   never invoke a bare `--stdin` and wait for input. Use
   `printf '%s' "$answer" | hchat request reply REQUEST_ID --stdin`, then
   `hchat request status REQUEST_ID answered`. If the result is uncertain,
   rerun that exact piped command; the CLI reuses its private pending key.
   State when the answer is from the Codex rather than an owner-approved
   commitment. Do not emit a separate acknowledgement before or after it.

For a non-Inbox session, finish with
`hchat processing complete MESSAGE_ID` after the reply is accepted, after a
legacy delivery is intentionally retired, or after a terminal/late result is
consumed. If this task abandons the delivery before replying, run
`hchat processing release MESSAGE_ID`. In Inbox, the router alone completes
the bridge delivery. Never complete or release before a durable request reply,
explicit refusal, or deliberate legacy/terminal classification has been
recorded in the task.
