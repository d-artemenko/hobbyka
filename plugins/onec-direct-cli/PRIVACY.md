# Privacy

`onec-direct-cli` has no analytics, telemetry, hosted backend, or credential collection. The local CLI communicates directly with the configured published 1C HTTP service.

Credentials stay in local environment variables or the user's local configuration file. They are not included in the plugin and must not be committed to a repository. Query results are printed locally and are not sent to Hobbyka or another model by the CLI.

The user controls 1C permissions, local logs, query files, and generated outputs.
