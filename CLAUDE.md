# CLAUDE.md — oneclick-subtitles-generator

An old, organically-grown subtitles/narration app. The brief is the opposite of "leave it
alone": **actively improve maintainability, solidity, and performance every time you touch it.**

## Who the customer is
The end user installs by downloading and running `OSG_installer_Windows.bat` from a GitHub
release onto a **clean Windows PC**. Judge every change by what happens for *them*, not on this
dev machine. The `.bat` clones `main` and runs the installer, so fixes pushed to `main` reach
customers on their next install/update — a **new release is only needed when the `.bat` file
itself changes** (then cut one matching the previous format; see `additional_docs/`).

## Refactor aggressively & prune
- Every change leaves the touched code better than you found it.
- **No code file over 600 lines.** Many existing files break this (worst are 1000–2500 lines).
  When you edit one, split it along real seams (extract hooks, helpers, sub-components, route
  handlers) instead of adding to it. New files start small and stay small.
- Prune as you go: delete dead code, unused exports/vars, commented-out blocks, and superseded
  approaches the moment you touch the area.
- **Centralize dependencies** into one shared helper; prefer a single clear way to do each thing
  over parallel implementations.
- Scope cleanup to the files the task touches — no repo-wide rewrite in one pass, and never
  modify unrelated uncommitted work.

## Keep it solid
- **Write tests for new behavior**; run them before committing; fix failing tests before adding
  more code.
- Add `.on('error')` to every spawned process — a missing binary must reject, never crash the
  server.
- **Prefer bundled binaries over system installs** so a clean PC works: ffmpeg/ffprobe resolve
  from `node_modules` via `server/services/shared/ffmpegUtils.js` (and yt-dlp gets
  `--ffmpeg-location`); Python services resolve the same bundled ffmpeg, never bare `'ffmpeg'`.
- **Pin** external TTS/model versions (don't fetch latest-from-git on install) for reproducible
  builds. The one exception is **`yt-dlp`**, which must auto-update to keep up with YouTube.
- Validate user input; never interpolate it into a shell command or Python source — pass data
  over stdin/args.

## Optimization & quiet output
- When touching hot paths, take the obvious wins: avoid per-render/per-event work, cache resolved
  paths, don't repeat expensive lookups.
- Keep the launch console quiet — noise reads as breakage to customers. Gate debug logging behind
  a flag (frontend: `localStorage.debug_logs`; suppress non-actionable third-party warnings).

## Commits
- Conventional commits (`feat:`/`fix:`/`refactor:`/`chore:`…) explaining *why*.
- **Never commit or push without explicit per-change sign-off.**
