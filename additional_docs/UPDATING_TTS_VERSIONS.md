# Keeping the TTS engines stable (version pinning)

The heavy engines install **on demand, per engine** (Settings → Tools → Download). Each engine's
installer pins exactly what it pulls from GitHub/PyPI so installs are reproducible — a bad upstream
push can't silently break every user.

## Where the pins live (the on-demand path)

| Engine | File | Constant / spec | Pin type |
| --- | --- | --- | --- |
| F5-TTS | `server/engines/installers/f5tts.js` | `F5_TTS_REF` | release tag (e.g. `1.1.20`) |
| Chatterbox | `server/engines/installers/chatterbox.js` | `CHATTERBOX_REF` | commit SHA (no reliable upstream tags) |
| Parakeet | `server/engines/installers/parakeet.js` | `ONNX_ASR_SPEC`, `ONNX_RUNTIME_VERSION` | exact `==` versions |
| PyTorch (all of the above) | `server/engines/torchProfile.js` | `TORCH_PROFILES` | exact `==` per GPU profile |

> **`yt-dlp` is deliberately NOT pinned** (`server/engines/installers/base.js`) — it must auto-update
> to keep up with YouTube.

> **Two more copies of the pins exist** for the legacy / packaged-Electron venv build:
> `setup-narration.js` and `update-narration-packages.js` each carry their own `TORCH_PROFILES` and
> engine refs. They are **not** on the customer path, but **keep them in sync** when you bump a pin —
> a change in the installers does not reach them automatically (the files are marked with a
> `KEEP IN SYNC` comment).

**Why pinning matters:** these used to be cloned from the default branch with no pin, so every
install pulled whatever upstream had pushed that day. Pinning to a known-good ref makes installs
reproducible and stable.

> **Chatterbox note:** it is pinned to a *commit* (the multilingual 0.1.7 release), not the older
> tagged `v0.1.2`, because the app imports `ChatterboxMultilingualTTS`, which v0.1.2 does not export.
> That commit also declares an UNPINNED `resemble-perth @ git+...Perth.git@master` dependency that
> fails to build under `--no-build-isolation`; `chatterbox.js` automatically rewrites it to the
> reproducible PyPI release `resemble-perth==1.0.1` (same version). When bumping `CHATTERBOX_REF`,
> keep both properties — a commit that still exports `ChatterboxMultilingualTTS`.

## The update routine

Do this periodically (e.g. monthly, or when you want newer engine features):

1. **Check upstream** for a newer release/commit on the engine's GitHub (F5-TTS / Chatterbox) or PyPI
   (onnx-asr, onnxruntime, torch). (There's no `check:tts-versions` helper anymore — read the
   upstream releases page directly.)

2. **Bump the constant** in the relevant installer file above. **Mirror the same bump** in
   `setup-narration.js` (and `update-narration-packages.js` for torch) so the Electron bundle stays
   consistent.

3. **Rebuild and verify end-to-end.** The cleanest check is to reinstall the engine and let its
   built-in verification run (it imports the exact symbols the app uses and the install FAILS if they
   don't resolve):
   - In the app: Settings → Tools → Download for that engine, OR
   - Headless: `node -e "require('./server/engines/installers/chatterbox').install({onLog:console.log})"`
     (swap `chatterbox` for `f5tts` / `parakeet`).

   If verification throws, the engine reads **not-installed** — revert the pin and keep the previous
   known-good ref.

4. **Commit** the bumped pins once verification passes, so everyone on the installer gets the same
   stable versions.

## Overriding a pin temporarily

`F5_TTS_REF` and `CHATTERBOX_REF` honor an environment-variable override, so you can test a candidate
ref without editing the file — set it before starting the server, then trigger the install:

```
# PowerShell
$env:CHATTERBOX_REF = "<commit-sha>"; node -e "require('./server/engines/installers/chatterbox').install({onLog:console.log})"
```
