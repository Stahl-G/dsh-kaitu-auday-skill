# DSH adapter

The root bundle exports this Host service and the built browser page. It uses
the same installed `scripts/` as the common skill. See
[host setup and verification limits](../../references/hosts.md).

`runner.mjs` owns only fixed CLI argument construction and managed process
cleanup. The Host remote accepts operation names and selected record IDs, never
shell text or a password. The native pair dialog remains inside the Swift
process; successful pairing reuses upstream Keychain persistence.

Import publishes completed plain Markdown to Kaitu's existing inbox. It does
not implement another importer or receipt ledger. Kaitu's watcher owns inbox
processing and user-visible refresh. Changed source payloads are separate
revisions, and imports never promote a candidate into confirmed memory.
