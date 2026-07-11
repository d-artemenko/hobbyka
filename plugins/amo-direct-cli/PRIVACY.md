# Privacy

`amo-direct-cli` has no analytics, telemetry, hosted backend, or credential collection. The local CLI sends read-only HTTPS requests directly from the user's machine to the configured amoCRM account.

Credentials stay in local environment variables or the user's local configuration file. They are not included in the plugin and must not be committed to a repository. CRM responses are printed locally; sensitive custom-field values are redacted by default.

The user controls amoCRM permissions, local logs, generated files, and any explicit use of `--include-sensitive`.
