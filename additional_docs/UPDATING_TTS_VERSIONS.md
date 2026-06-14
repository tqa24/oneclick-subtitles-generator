# Keeping the TTS engines stable (version pinning)

The narration setup (`setup-narration.js`) installs three things straight from GitHub:

| Engine | Constant in `setup-narration.js` | Pin type |
| --- | --- | --- |
| F5-TTS | `F5_TTS_REF` | release tag (e.g. `1.1.20`) |
| Chatterbox | `CHATTERBOX_REF` | commit SHA (no reliable release tags upstream) |
| ChromeCookieUnlock (yt-dlp plugin) | `YTDLP_COOKIE_PLUGIN_REF` | commit SHA |

**Why pinning matters:** these used to be cloned from the default branch with no pin, so every
install pulled whatever upstream had pushed that day. A bad upstream commit = every user's install
breaks. Pinning to a known-good ref makes installs reproducible and stable.

> **Chatterbox note:** it is pinned to a *commit* (the multilingual 0.1.7 release), not the older
> tagged `v0.1.2`, because the app imports `ChatterboxMultilingualTTS`, which v0.1.2 does not export.
> That commit also declares an UNPINNED `resemble-perth @ git+...Perth.git@master` dependency that
> fails to build under `--no-build-isolation`; `setup-narration.js` automatically rewrites it to the
> reproducible PyPI release `resemble-perth==1.0.1` (the same version). When bumping `CHATTERBOX_REF`,
> keep both properties — a commit that still exports `ChatterboxMultilingualTTS` — and always re-verify
> with `npm run setup:narration:uv` (its end-state check imports the exact symbols the app uses).

## The regular update routine

Do this periodically (e.g. monthly, or when you want newer engine features):

1. **See what's behind upstream:**
   ```
   npm run check:tts-versions
   ```
   It prints, per engine, the currently pinned ref vs. the latest upstream ref, and the exact
   constant to edit when something is out of date. It only reads upstream metadata — no installs.

2. **Bump the pin(s)** in `setup-narration.js` — update the default value of the relevant constant
   (`F5_TTS_REF`, `CHATTERBOX_REF`, or `YTDLP_COOKIE_PLUGIN_REF`) to the new ref.

3. **Rebuild and verify end-to-end:**
   ```
   npm run setup:narration:uv
   ```
   This rebuilds the shared `.venv` and runs the built-in verification (F5-TTS, Chatterbox,
   Parakeet imports + the final service check). If anything fails, revert the pin and keep the
   previous known-good ref.

4. **Commit** the bumped pin once verification passes, so all users on the PowerShell installer get
   the same stable versions.

## Overriding a pin temporarily

Each constant honors an environment variable override, so you can test a candidate ref without
editing the file:

```
# PowerShell
$env:CHATTERBOX_REF = "<commit-sha>"; npm run setup:narration:uv
```

Available overrides: `F5_TTS_REF`, `CHATTERBOX_REF`, `YTDLP_COOKIE_PLUGIN_REF`.
