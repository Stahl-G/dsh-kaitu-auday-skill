# Desktop hosts and the optional DSH adapter

The root `SKILL.md`, `scripts/`, and references are the common skill. Connection,
sync, cached search, and selected-note rendering use the same Python/Swift core.
There is no host-specific transport protocol or automatic background sync.

| Host | Entry point | Evidence and limits |
| --- | --- | --- |
| Codex | Install the common skill in the configured local skills directory | The existing Mac installation is discoverable. This fork has not been installed over it. |
| Claude Code | Common skill at `~/.claude/skills/auday/SKILL.md` or a project skill directory | [Official skill documentation](https://code.claude.com/docs/en/skills) documents these locations and supporting scripts. Discovery and local execution still require a host smoke test. |
| WorkBuddy | Import the common skill using the application's installed-skills workflow | [Official skills page](https://www.workbuddy.ai/docs/zh/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market) documents local skill management. An installation path, TTY behavior, and actual script execution have not been verified; do not infer them from Claude Code compatibility. |
| DSH / Kaitu | Root npm bundle; separate `adapters/dsh/` UI and Host service | Targets DSH 0.2.1-rc.2. No model tool exposes arbitrary commands, passwords, or pairing. |

## DSH on Mac

The adapter requires existing Python 3 and Xcode Command Line Tools. It never
runs `bootstrap.sh`, installs software or models, accepts terms, transcribes,
or starts a synchronization loop. The native Swift helper builds on first live
connection using the installed toolchain. It is not a signed precompiled helper;
clean-Mac packaging and platform permissions remain separate release checks.

Version 0.1.2 is being prepared on the adapter branch; no 0.1.2 release is published.
For an approved local build, install the packed tarball through DSH's existing
profile plugin manager. The earlier 0.1.0 experimental prerelease remains a
separate, unmerged experiment and does not establish real-phone or clean-Mac
support. Check prerequisites, find the phone, and choose Connect. This explicit action opens a native hidden
password dialog and saves successful pairing through the upstream Keychain code.
The original TTY pairing path is retained for common skill hosts. Cancel or page
unmount terminates the adapter's managed subprocess range.

Sync once captures a single upstream snapshot. Browse the cached copy, select
records, preview their text and state, then submit them as pending inbox notes.
No manual export is needed. The desktop supplies `KAITU_DIR`; plain DSH must
configure the bundle's `workspace` to an existing Kaitu workspace. `python` may
select an installed interpreter. Cache and pairing use `DSH_HOME/auday/default`
(or `~/.dsh/auday/default`), separate from an existing common-skill installation.

The adapter writes completed plain Markdown to `inbox/agents`; Kaitu's existing
watcher processes it. It does not write goals, memories, or actions. This depends
on the ordinary-file resend handling in Kaitu main `a9544c6` or later. Filenames
encode device ID, record ID and the full record revision; note bytes exclude
sync/export time. The host's existing basename-plus-raw receipt skips identical
resends, including after processing or restart. Changed content becomes a
separate source revision for review. Rejected and candidate memories retain
their source states. Source text and full payload are fenced as inert data.

## Development checks

`npm run build` generates the Typert contribution and distributable artifacts.
Build dependencies are pinned in `package.json`; none are downloaded by tests.
Run `npm run typecheck`, `npm test`, and
`python3 -m unittest discover -s tests -p test_handoff.py`.
The upstream public-source Git guards require Git LFS. Enable them only in this
checkout with `sh tools/git/install-hooks.sh`.

Synthetic rendering, pending-file retry, and lifecycle checks do not establish
real iPhone pairing, native-dialog dismissal on application exit, a clean Mac
installation, or WorkBuddy/Claude Code runtime compatibility. Those checks need
their own evidence; persistent pairing and private data access require the
user's authorization for that session.

The page reads Kaitu's surface, text, control and feedback color variables, with
the desktop C palette as its standalone fallback. It follows DSH/system dark
mode. The existing host route `#kaitu-page=kaitu-auday&kaitu-embed=1` suppresses
the plugin title; the host still owns its loader, navigation and iframe lifetime.
Content embedding requires Kaitu's host integration in PR #121 (not main at the
time of this update); no new loader or theme messaging protocol is provided.
Prerequisite checks reuse the common core's selected CLT/Swift checks before
live operations; the system Python shim is not started when CLT is absent.
