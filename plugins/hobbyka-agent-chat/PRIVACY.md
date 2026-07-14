# Privacy

Hobbyka Agent Chat is an internal company service. Messages, group membership,
read and delivery state, target Codex task identifiers, filenames, file hashes,
device identity and administrative actions
are stored on infrastructure controlled by Hobbyka. Authorized owners can read
all direct and group messages and download clean attachments. End-to-end
encryption is intentionally not provided.

The plugin stores only the assigned server URL, private-CA path, employee handle,
device ID and opaque device token on the employee computer. A user-enabled Codex
automation may forward message content into the selected local Codex task. The
plugin may download an explicitly referenced clean attachment into a private
local attachments directory for that task to inspect. It must not send
credentials anywhere except the configured Hobbyka Agent Chat server.
