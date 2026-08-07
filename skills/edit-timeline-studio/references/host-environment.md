# Host environment setup

Use this reference before the first local edit, replication analysis, or command-layer render on a newly installed Skill.

## Installation contract

Treat Skill installation and host-environment installation as separate actions. Installing the Skill may copy instructions and scripts, but it must not silently install system packages, modify shell profiles, download large models, request credentials, or enable paid services.

Run the read-only doctor first:

```bash
node scripts/setup-host.mjs --check
```

If Node.js itself is missing, too old, or cannot launch the doctor, use the zero-dependency language-runtime bootstrap first:

```bash
sh scripts/bootstrap-host.sh --check
# after reviewing the plan and granting approval:
sh scripts/bootstrap-host.sh --install
```

On Windows PowerShell, use `scripts/bootstrap-host.ps1` with `-Install`. These bootstrap routes install or upgrade only Node.js and Python through an already available trusted system package manager, then verify the resulting versions. They never pipe a remote script into a shell.

Use `--json` when an Agent needs machine-readable results. Read `host-requirements.json` for the declared commands, versions, Python packages, purposes, and capabilities that are never automatic.

If required tools are missing, show the exact installation plan and why each item is needed. Obtain explicit user authorization before running:

```bash
node scripts/setup-host.mjs --install
```

The installer remains interactive unless `--yes` is passed. An Agent may pass `--yes` only after the user explicitly approved the displayed plan. Do not treat approval to install the Skill as approval to modify the host environment.

## Isolation and discovery

Install Python analysis packages into a dedicated Timeline Studio virtual environment under the user's application-data directory. Do not use system-wide `pip`, alter an existing project environment, or write a second model cache. Run Python tools through:

```bash
node scripts/run-host-python.mjs scripts/analyze_replication.py <reference-video> --output-dir <analysis-dir>
```

The wrapper prefers the dedicated environment and falls back to a compatible existing Python only when all declared imports pass.

## Pre-voiceover environment

Before generating any Agent-driven Chinese narration that contains inline English, check the dedicated MeloTTS capability instead of discovering its dependencies during synthesis:

```bash
node scripts/setup-host.mjs --check --capability voiceover
```

If it is unavailable, show the printed plan and obtain explicit authorization before running:

```bash
node scripts/setup-host.mjs --install --capability voiceover
```

This creates a separate `voiceover-python` virtual environment, installs MeloTTS from the immutable upstream revision declared in `host-requirements.json`, downloads UniDic language resources, and verifies `melo.api`, `unidic`, and the installed dictionary. Keep it separate from the media-analysis environment because MeloTTS has a large, tightly coupled Python dependency graph. A successful package-manager exit is not readiness: the capability must pass the doctor before pre-voiceover generation starts.

The runtime install is not permission to download mutable or unapproved voice checkpoints. Resolve MeloTTS model artifacts through an authorized, immutable source and report their license, size, revision, cache path, and provenance before acquisition. Do not let a synthesis call silently fetch an unpinned model. Keep browser OpenVoice V2 as a second-stage timbre converter only; it does not replace MeloTTS as the Chinese-and-English base-speech engine for Agent-driven pre-voiceover.

## Platform behavior

- macOS: use Homebrew only when it is already available; otherwise print manual prerequisites.
- Linux: use `apt-get` through `sudo` only after explicit approval and only for declared packages.
- Windows: use `winget` only after explicit approval and only for declared packages.
- Unknown platforms: perform checks and print a manual plan; never guess a package manager.

After installation, rerun the doctor and verify real imports plus `ffmpeg`/`ffprobe` execution. A successful package-manager exit alone is not a pass.

## Models and optional capabilities

Keep model acquisition separate. Inventory repository-owned pinned mirrors and existing caches using [local-model-routing.md](local-model-routing.md). Report the exact missing capability, size, license, mirror, immutable revision, and storage requirement, then obtain separate authorization before downloading. Never bundle model installation into `--install`.
