# Local macOS and Codex workflow

This workflow installs Timeline Studio as an on-demand local static application for macOS and exposes the repository command layer to Codex. It is designed for a single-user workstation that should not run a login item, LaunchAgent, daemon, or permanently listening web server.

For the Chinese version, see [local-macos-codex-workflow.zh-CN.md](local-macos-codex-workflow.zh-CN.md).

## Architecture

```text
Timeline Studio Local.app
  ├─ embedded production dist
  ├─ embedded zero-dependency static server
  └─ launcher process
       ├─ starts Node only while the App is running
       ├─ listens on http://127.0.0.1:4173
       └─ opens the local page in Safari

Codex
  ├─ edit-timeline-studio Skill → repository Skill link
  └─ timeline_studio_local MCP → repository npm run mcp
```

The App and Codex integration share a source checkout but have separate execution paths:

- A person opens the App from the Dock. The App starts its bundled static server, opens Safari, and stops the server when the App quits.
- Codex uses the repository command runner or STDIO MCP server for deterministic local operations. It does not need Safari for supported project inspection, editing, import, or headless rendering.
- UI-only operations may still use a running local editor through a supported browser-control path.

## What “offline” means

The production HTML, JavaScript, CSS, WASM runtime files, icons, and bundled media assets are copied into the App. Opening the editor does not load the hosted Timeline Studio website.

The repository intentionally does not bundle every AI model. AI music, ASR, TTS, restoration, face swap, and other model-backed features may need a first network download. Successfully cached models can be reused by the same browser origin. Codex command-layer operations that use only local media, `.timeline` archives, FFmpeg, and the supported headless renderer do not require those browser model downloads.

## Security and lifecycle properties

- The static server binds only to `127.0.0.1` and validates the HTTP `Host` header.
- It serves files only from the App's embedded `Site` directory and rejects path traversal.
- It sends the same COOP, COEP, and CORP isolation headers required by the browser media workers.
- The server starts only when `Timeline Studio Local.app` starts.
- Quitting the App sends `SIGTERM` to the server and uses a bounded forced shutdown only if needed.
- The installer does not create a LaunchAgent, LaunchDaemon, login item, scheduled task, or shell-profile entry.
- The App is ad-hoc signed for local development use. It is not Developer ID signed or notarized.

## Requirements

- macOS 13 or later
- Safari
- Node.js 20 or later
- npm
- Xcode Command Line Tools with `swiftc`
- FFmpeg and FFprobe for the Codex headless media workflow
- Codex CLI for global MCP registration

Run the read-only host check before first use:

```bash
npm run skill:doctor
```

Do not run `npm run skill:setup` unless you reviewed its plan and explicitly want it to install missing declared host dependencies.

## Build and install

From the repository root:

```bash
npm ci
npm run local:app:install
```

The installer performs these steps:

1. Builds the Vite production `dist`.
2. Compiles the native Swift launcher.
3. Embeds `dist` and the static server inside the App.
4. Creates an ad-hoc signature.
5. Creates a `ditto` zip and verifies the signature after extraction.
6. Gracefully quits an installed launcher when it is running, then installs the App at `/Applications/Timeline Studio Local.app`.
7. Unregisters the build and replaced copies from LaunchServices, moves the old App to Trash with a recoverable `.app.retired` suffix, and registers only the installed App.
8. Refreshes the Dock file bookmark, restarts Dock, and launches the App so updates do not leave a duplicate question-mark tile.

Build without installing:

```bash
npm run local:app:build
```

Artifacts are written to `.artifacts/macos-local/`, which is ignored by Git.

Useful installer options:

```bash
bash scripts/macos-local/install-app.sh --no-launch
bash scripts/macos-local/install-app.sh --no-dock
bash scripts/macos-local/install-app.sh --skip-build
bash scripts/macos-local/install-app.sh --install-dir "$HOME/Applications"
```

The App records the absolute Node executable used at build time. Rebuild the App after removing or relocating that Node installation.

## Runtime behavior

Open `Timeline Studio Local` from the Dock. Safari opens:

```text
http://127.0.0.1:4173/
```

Closing only the Safari tab does not quit the launcher. Quit `Timeline Studio Local` from its Dock menu or application menu to stop the local server. Clicking the launcher again while it is running reopens the page in Safari.

The launcher log is stored at:

```text
~/Library/Logs/Timeline Studio Local/preview.log
```

## Codex integration

Install the repository Skill link and a global STDIO MCP entry:

```bash
npm run codex:install -- --check
npm run codex:install
```

The first command is a read-only preflight and does not change Codex configuration.

The script:

- links `skills/edit-timeline-studio` into the active Codex skills directory, keeping the Skill aligned with this checkout;
- registers `timeline_studio_local` through `codex mcp add`;
- points `TIMELINE_STUDIO_ROOT` at this checkout;
- does not install host packages, download models, request an OpenAI API key, or alter shell profiles.

If either target already exists, the script stops instead of overwriting it. Review the existing target, then use the explicit replacement path if appropriate:

```bash
bash scripts/macos-local/install-codex-integration.sh --force
```

`--force` moves an existing Skill target to a timestamped backup and replaces the MCP entry. Start a new Codex session after installation so the Skill and MCP inventory can refresh.

Example Codex request:

```text
Use $edit-timeline-studio. Inspect /absolute/path/project.timeline, preview a revision-safe
plan, save the edited archive to a new path, reopen it, and report the revision and track summary.
```

For supported MCP writes, Codex should inspect, call `timeline_project_diff`, review the result, call `timeline_project_apply` with the same revision and operations, and inspect the output archive. The MCP server never overwrites an existing output path.

## Verification

Verify an installed App:

```bash
npm run local:app:verify
```

The check validates:

- the App signature and bundle identifier;
- the embedded site, server, launcher, and configuration;
- absence of Timeline Studio LaunchAgent and LaunchDaemon files;
- HTTP 200 delivery and byte-range support;
- COOP, COEP, CORP, and local-server marker headers;
- server shutdown and closed-port behavior.

Verify Codex registration:

```bash
codex mcp get timeline_studio_local --json
readlink "${CODEX_HOME:-$HOME/.codex}/skills/edit-timeline-studio"
```

The repository also retains its project-local `.codex/config.toml`. When Codex opens this repository directly, that configuration exposes the `timeline_studio` server without relying on the global `timeline_studio_local` entry.

## Updating

Updates are explicit. The App never pulls source or rebuilds itself:

```bash
git fetch upstream
git merge --ff-only upstream/main
npm ci
npm run check
npm run local:app:install
```

Review upstream changes before merging. Reinstalling moves an existing App to the Trash before installing the verified replacement.

## Uninstall

Remove the App and Dock item:

```bash
npm run local:app:uninstall
```

Remove the global Codex Skill link and MCP entry:

```bash
npm run codex:uninstall
```

The uninstallers do not delete the repository, project files, rendered media, timestamped Skill backups, model caches, or Safari site data. Remove those separately only after reviewing the exact targets.

## Gatekeeper notes

Local builds are ad-hoc signed and are not notarized with an Apple Developer ID. A build created and installed on the same Mac normally has no quarantine attribute. If a copied or downloaded build is blocked, first open **System Settings → Privacy & Security** and choose **Open Anyway**.

If macOS reports that a trusted copied build is damaged even after approval, use quarantine removal only as a fallback:

```bash
sudo xattr -r -d com.apple.quarantine "/Applications/Timeline Studio Local.app"
```

Frictionless public distribution requires Developer ID signing, notarization, and stapling. Ad-hoc signing is not a substitute.

## Troubleshooting

### Port 4173 is already in use

Quit the existing `Timeline Studio Local` process. If another application owns the port, stop it or change the port in `build-app.sh` and rebuild. The launcher uses a strict fixed origin so browser storage and Service Worker caches remain stable between launches.

### Dock shows both a question mark and the normal App icon

The question mark means Dock or LaunchServices still references an App bundle that was replaced. Re-running the installer unregisters the build and retired copies, stores Trash backups with a non-discoverable `.app.retired` suffix, registers only the App in `/Applications`, and refreshes the Dock bookmark. To repair only Dock without rebuilding, run:

```bash
bash scripts/macos-local/dock.sh add "/Applications/Timeline Studio Local.app"
```

### Safari opens but the page is unavailable

Inspect the launcher log and rerun verification:

```bash
tail -100 "$HOME/Library/Logs/Timeline Studio Local/preview.log"
npm run local:app:verify
```

### Codex does not show the Skill or MCP tools

Start a new Codex session, then run:

```bash
codex mcp get timeline_studio_local --json
```

Confirm that the linked checkout still exists at the same absolute path. If the repository moved, rerun `npm run codex:install` with `--force` through the underlying script.

### An advanced feature fails in Safari

Safari compatibility may differ from Chromium for WebGPU, WebCodecs, and browser model runtimes. Keep deterministic Codex work on the CLI/MCP path. For a verified UI-only operation that requires Chromium, start the same local App and open its loopback URL in a supported Chromium browser without changing the static deployment model.
