>>>>THIS FILE IS THE LOG RAN BY npm run dist:win
src\utils\progressWebSocketClient.js
  Line 5:10:  'SERVER_URL' is defined but never used  no-unused-vars

src\utils\qualityScanner.js
  Line 13:7:  'isDouyinUrl' is assigned a value but never used  no-unused-vars

static/css/main.32a7eb41.css from Css Minimizer plugin
postcss-calc: C:\WORK_win\oneclick-subtitles-generator\static\css\main.32a7eb41.css:4808:10: Lexical error on line 1: Unrecognized text.

  Erroneous area:
1: 1 - (clamp(0, calc(var(--pill-travel) / 320), 0.28) * 0.55)
^..............................................^

Search for the keywords to learn more about each warning.
To ignore, add // eslint-disable-next-line to the line before.

File sizes after gzip:

  639.95 kB  build\static\js\main.62a5efa6.js
  94.87 kB   build\static\css\main.2eee1276.css
  28.16 kB   build\static\js\728.3731bb9e.chunk.js
  5.12 kB    build\static\js\109.96a31f2a.chunk.js
  3.82 kB    build\static\js\349.9ae7fa07.chunk.js
  2.49 kB    build\static\js\676.0867ac67.chunk.js
  1.68 kB    build\static\js\843.d08176fd.chunk.js
  1.65 kB    build\static\js\368.cd621cb9.chunk.js
  1 kB       build\static\js\863.9c834afe.chunk.js
  893 B      build\static\js\872.f24d1702.chunk.js
  821 B      build\static\js\584.6ce26757.chunk.js
  811 B      build\static\js\879.3caef4d3.chunk.js
  486 B      build\static\js\521.db1218e7.chunk.js
  440 B      build\static\js\58.58f5c2da.chunk.js
  392 B      build\static\js\472.f6ff7832.chunk.js

The bundle size is significantly larger than recommended.
Consider reducing it with code splitting: https://goo.gl/9VhYWB
You can also analyze the project dependencies: https://goo.gl/LeUzfb

The project was built assuming it is hosted at ./.
You can control this with the homepage field in your package.json.

The build folder is ready to be deployed.

Find out more about deployment here:

  https://cra.link/deployment

ℹ️  Preparing Python environment for Electron build...
ℹ️  Source .venv found at C:\WORK_win\oneclick-subtitles-generator\.venv
ℹ️  Removing old wheelhouse venv...
ℹ️  Copying .venv to C:\WORK_win\oneclick-subtitles-generator\bin\python-wheelhouse\venv...
✅ Python environment copied successfully
✅ Verification passed: python.exe found in wheelhouse
ℹ️  Verifying critical packages...
All packages verified
✅ All packages verified
✅ Electron build preparation completed successfully!
  • electron-builder  version=25.1.8 os=10.0.26200
  • loaded configuration  file=package.json ("build" field)
  • public/electron.js not found. Please see https://medium.com/@kitze/%EF%B8%8F-from-react-to-an-electron-app-ready-for-production-a0468ecb1da3
  • loaded parent configuration  preset=react-cra
  • writing effective config  file=electron-dist\builder-effective-config.yaml
  • executing @electron/rebuild  electronVersion=33.4.11 arch=x64 buildFromSource=false appDir=./
  • installing native dependencies  arch=x64
  • completed installing native dependencies
  • packaging       platform=win32 arch=x64 electron=33.4.11 appOutDir=electron-dist\win-unpacked   
  • updating asar integrity executable resource  executablePath=electron-dist\win-unpacked\One-Click Subtitles Generator.exe
  • signing with signtool.exe  path=electron-dist\win-unpacked\resources\python-venv\venv\Scripts\accelerate-config.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=electron-dist\win-unpacked\resources\python-venv\venv\Scripts\accelerate-estimate-memory.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=electron-dist\win-unpacked\resources\python-venv\venv\Scripts\accelerate-merge-weights.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=electron-dist\win-unpacked\resources\python-venv\venv\Scripts\accelerate.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=nu
.....
[unimportant logs of no signings here....]
........
  • signing with signtool.exe  path=electron-dist\win-unpacked\resources\bin\python-wheelhouse\venv\Lib\site-packages\distlib\t64.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=electron-dist\win-unpacked\resources\bin\python-wheelhouse\venv\Lib\site-packages\distlib\t32.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=electron-dist\win-unpacked\resources\python-venv\venv\Lib\site-packages\distlib\t32.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • default Electron icon is used  reason=application icon is not set
  • signing with signtool.exe  path=electron-dist\win-unpacked\One-Click Subtitles Generator.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=electron-dist\win-unpacked\resources\app.asar.unpacked\node_modules\@remotion\compositor-win32-x64-msvc\ffmpeg.exe
  • signing with signtool.exe  path=electron-dist\win-unpacked\resources\app.asar.unpacked\node_modules\@remotion\compositor-win32-x64-msvc\ffprobe.exe
  • signing with signtool.exe  path=electron-dist\win-unpacked\resources\app.asar.unpacked\node_modules\@remotion\compositor-win32-x64-msvc\remotion.exe
  • signing with signtool.exe  path=electron-dist\win-unpacked\resources\app.asar.unpacked\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=electron-dist\win-unpacked\resources\app.asar.unpacked\node_modules\@esbuild\win32-x64\esbuild.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • building        target=nsis file=electron-dist\One-Click Subtitles Generator Setup 1.0.0.exe archs=x64 oneClick=false perMachine=false
  • signing with signtool.exe  path=electron-dist\win-unpacked\resources\elevate.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=electron-dist\__uninstaller-nsis-subtitles-generator.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=electron-dist\One-Click Subtitles Generator Setup 1.0.0.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • building block map  blockMapFile=electron-dist\One-Click Subtitles Generator Setup 1.0.0.exe.blockmap
  • building        target=portable file=electron-dist\One-Click Subtitles Generator 1.0.0.exe archs=x64
  • signing with signtool.exe  path=electron-dist\One-Click Subtitles Generator 1.0.0.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null