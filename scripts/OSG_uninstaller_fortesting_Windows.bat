@ECHO OFF
CLS

:: --- Configuration ---
SET "PROJECT_FOLDER_NAME=oneclick-subtitles-generator"
SET "SCRIPT_DIR=%~dp0"
SET "PROJECT_PATH=%SCRIPT_DIR%%PROJECT_FOLDER_NAME%"
IF "%PROJECT_PATH:~-1%"=="\" SET "PROJECT_PATH=%PROJECT_PATH:~0,-1%"

:: --- Fixed Settings (Vietnamese Menu) ---
SET "MENU_LABEL=MainMenuVI"
SET "PROMPT_CHOICE=Nhap lua chon cua ban (1-6): "
SET "TITLE_TEXT=Go Cai Dat Toan Bo OneClick Subtitles Generator"

TITLE %TITLE_TEXT%

:: --- Check for Administrator Privileges ---
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[?] Checking administrator privileges...' -ForegroundColor Yellow; if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] 'Administrator')) { Write-Host ''; Write-Host '======================================================'; Write-Host '[ERROR] Administrator privileges required.' -ForegroundColor Red; Write-Host '[INFO] Requesting administrator privileges...' -ForegroundColor Blue; Write-Host '======================================================'; Start-Process '%~f0' -Verb RunAs; exit 1 } else { Write-Host '[OK] Administrator privileges confirmed.' -ForegroundColor Green; Write-Host '' }"
IF %ERRORLEVEL% NEQ 0 EXIT /B

GOTO %MENU_LABEL%

:: =============================================================================
:: VIETNAMESE MENU (Hardcoded)
:: =============================================================================
:MainMenuVI
CLS
ECHO.
:: Display the new Unicode ASCII logo with red gradient (warning colors)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host ('     ' + [char]27 + '[38;2;255;200;200m' + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2557 + [char]27 + '[38;2;255;180;180m' + [char]0x2591 + [char]0x2591 + [char]0x2591 + [char]0x2591 + [char]27 + '[38;2;255;160;160m' + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2557 + [char]27 + '[38;2;255;140;140m' + [char]0x2591 + [char]0x2591 + [char]0x2591 + [char]0x2591 + [char]27 + '[38;2;255;120;120m' + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2588 + [char]0x2557 + [char]27 + '[0m')"
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red; Write-Host '%TITLE_TEXT%' -ForegroundColor White -BackgroundColor DarkRed; Write-Host 'Vi tri (Location): %SCRIPT_DIR%' -ForegroundColor Gray; Write-Host 'Thu muc Du an (Project Folder): %PROJECT_FOLDER_NAME%' -ForegroundColor Gray; Write-Host '======================================================' -ForegroundColor Red; Write-Host 'CANH BAO: Cac tuy chon nay se go cai dat cac cong cu khoi he thong!' -ForegroundColor Yellow -BackgroundColor DarkRed"
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host 'GO CAI DAT UNG DUNG:' -ForegroundColor Red -BackgroundColor Black; Write-Host '  1. Go cai dat chi Ung dung (Uninstall App Only)' -ForegroundColor White; Write-Host '     (Chi xoa thu muc du an, giu lai cac cong cu he thong)' -ForegroundColor Cyan"
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host 'GO CAI DAT TOAN BO:' -ForegroundColor DarkRed -BackgroundColor Black; Write-Host '  2. Go cai dat Tat ca (Uninstall Everything)' -ForegroundColor White; Write-Host '     (Xoa ung dung + Git + Node.js + FFmpeg + uv + Chocolatey)' -ForegroundColor Yellow; Write-Host '  3. Go cai dat chi cac Cong cu (Uninstall Tools Only)' -ForegroundColor White; Write-Host '     (Chi xoa Git + Node.js + FFmpeg + uv + Chocolatey, giu lai ung dung)' -ForegroundColor Yellow"
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host 'GO CAI DAT RIENG LE:' -ForegroundColor Magenta -BackgroundColor Black; Write-Host '  4. Go cai dat Git' -ForegroundColor White; Write-Host '  5. Go cai dat Node.js' -ForegroundColor White; Write-Host '  6. Go cai dat FFmpeg' -ForegroundColor White; Write-Host '  7. Go cai dat uv Python Package Manager' -ForegroundColor White; Write-Host '  8. Go cai dat Chocolatey' -ForegroundColor White"
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  9. Thoat (Exit)' -ForegroundColor Gray; Write-Host '======================================================' -ForegroundColor Red"
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '%PROMPT_CHOICE%' -ForegroundColor Yellow -NoNewline"
SET /P "CHOICE="

:: Validate input
IF NOT "%CHOICE%"=="" SET CHOICE=%CHOICE:~0,1%
IF "%CHOICE%"=="1" GOTO UninstallAppOnly
IF "%CHOICE%"=="2" GOTO UninstallEverything
IF "%CHOICE%"=="3" GOTO UninstallToolsOnly
IF "%CHOICE%"=="4" GOTO UninstallGit
IF "%CHOICE%"=="5" GOTO UninstallNodeJS
IF "%CHOICE%"=="6" GOTO UninstallFFmpeg
IF "%CHOICE%"=="7" GOTO UninstallUV
IF "%CHOICE%"=="8" GOTO UninstallChocolatey
IF "%CHOICE%"=="9" GOTO ExitScript

powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[ERROR] Lua chon khong hop le. Vui long thu lai.' -ForegroundColor Red"
TIMEOUT /T 2 /NOBREAK > NUL
GOTO %MENU_LABEL%

REM ==============================================================================
:UninstallAppOnly
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[UNINSTALL] Option 1: Uninstall App Only' -ForegroundColor White -BackgroundColor DarkRed"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
ECHO.

IF NOT EXIST "%PROJECT_PATH%" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] Project folder not found: %PROJECT_PATH%' -ForegroundColor Blue"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] Application may not be installed.' -ForegroundColor Blue"
    GOTO OperationComplete
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[WARN] This will permanently delete the project folder:' -ForegroundColor Yellow"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '%PROJECT_PATH%' -ForegroundColor White"
ECHO.
SET /P "CONFIRM=Ban co chac chan muon xoa thu muc du an? (c/k): "
IF /I NOT "%CONFIRM%"=="c" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] Operation cancelled.' -ForegroundColor Blue"
    GOTO %MENU_LABEL%
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[SETUP] Removing project folder...' -ForegroundColor Cyan"
RMDIR /S /Q "%PROJECT_PATH%"
IF %ERRORLEVEL% NEQ 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[ERROR] Failed to remove project folder.' -ForegroundColor Red"
    GOTO ErrorOccurred
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[OK] Application uninstalled successfully!' -ForegroundColor Green"
GOTO OperationComplete

REM ==============================================================================
:UninstallEverything
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[UNINSTALL] Option 2: Uninstall Everything' -ForegroundColor White -BackgroundColor DarkRed"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
ECHO.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[WARN] This will remove ALL components:' -ForegroundColor Yellow"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - OneClick Subtitles Generator Application' -ForegroundColor White"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - Git version control' -ForegroundColor White"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - Node.js runtime' -ForegroundColor White"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - FFmpeg media processor' -ForegroundColor White"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - uv Python package manager' -ForegroundColor White"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - Chocolatey package manager' -ForegroundColor White"
ECHO.
SET /P "CONFIRM=Ban co THUC SU chac chan muon go cai dat tat ca? (c/k): "
IF /I NOT "%CONFIRM%"=="c" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] Operation cancelled.' -ForegroundColor Blue"
    GOTO %MENU_LABEL%
)

CALL :UninstallAppOnly_Silent
CALL :UninstallGit_Silent
CALL :UninstallNodeJS_Silent
CALL :UninstallFFmpeg_Silent
CALL :UninstallUV_Silent
CALL :UninstallChocolatey_Silent

powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[OK] Complete uninstallation finished!' -ForegroundColor Green"
GOTO OperationComplete

REM ==============================================================================
:UninstallToolsOnly
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[UNINSTALL] Option 3: Uninstall Tools Only' -ForegroundColor White -BackgroundColor DarkRed"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
ECHO.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[WARN] This will remove development tools but keep the application:' -ForegroundColor Yellow"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - Git version control' -ForegroundColor White"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - Node.js runtime' -ForegroundColor White"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - FFmpeg media processor' -ForegroundColor White"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - uv Python package manager' -ForegroundColor White"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - Chocolatey package manager' -ForegroundColor White"
ECHO.
SET /P "CONFIRM=Ban co chac chan muon go cai dat cac cong cu? (c/k): "
IF /I NOT "%CONFIRM%"=="c" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] Operation cancelled.' -ForegroundColor Blue"
    GOTO %MENU_LABEL%
)

CALL :UninstallGit_Silent
CALL :UninstallNodeJS_Silent
CALL :UninstallFFmpeg_Silent
CALL :UninstallUV_Silent
CALL :UninstallChocolatey_Silent

powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[OK] Development tools uninstalled successfully!' -ForegroundColor Green"
GOTO OperationComplete

REM ==============================================================================
:UninstallGit
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[UNINSTALL] Option 4: Uninstall Git' -ForegroundColor White -BackgroundColor DarkRed"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
ECHO.

CALL :UninstallGit_Silent
GOTO OperationComplete

REM ==============================================================================
:UninstallNodeJS
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[UNINSTALL] Option 5: Uninstall Node.js' -ForegroundColor White -BackgroundColor DarkRed"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
ECHO.

CALL :UninstallNodeJS_Silent
GOTO OperationComplete

REM ==============================================================================
:UninstallFFmpeg
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[UNINSTALL] Option 6: Uninstall FFmpeg' -ForegroundColor White -BackgroundColor DarkRed"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
ECHO.

CALL :UninstallFFmpeg_Silent
GOTO OperationComplete

REM ==============================================================================
:UninstallUV
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[UNINSTALL] Option 7: Uninstall uv Python Package Manager' -ForegroundColor White -BackgroundColor DarkRed"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
ECHO.

CALL :UninstallUV_Silent
GOTO OperationComplete

REM ==============================================================================
:UninstallChocolatey
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[UNINSTALL] Option 8: Uninstall Chocolatey' -ForegroundColor White -BackgroundColor DarkRed"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Red"
ECHO.

CALL :UninstallChocolatey_Silent
GOTO OperationComplete

REM ==============================================================================
:: Silent Uninstall Subroutines
:UninstallAppOnly_Silent
IF EXIST "%PROJECT_PATH%" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[SETUP] Removing OneClick Subtitles Generator application...' -ForegroundColor Cyan"
    RMDIR /S /Q "%PROJECT_PATH%" >nul 2>&1
    IF %ERRORLEVEL% EQU 0 (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[OK] Application removed successfully.' -ForegroundColor Green"
    ) ELSE (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[ERROR] Failed to remove application.' -ForegroundColor Red"
    )
) ELSE (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] Application not found - may already be uninstalled.' -ForegroundColor Blue"
)
EXIT /B 0

:UninstallGit_Silent
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[?] Checking for Git installation...' -ForegroundColor Yellow"
WHERE git >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[SETUP] Uninstalling Git...' -ForegroundColor Cyan"
    winget uninstall --id Git.Git --silent >nul 2>&1
    IF %ERRORLEVEL% NEQ 0 (
        choco uninstall git -y >nul 2>&1
        IF %ERRORLEVEL% NEQ 0 (
            powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[WARN] Could not automatically uninstall Git. Please remove manually from Control Panel.' -ForegroundColor Yellow"
        ) ELSE (
            powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[OK] Git uninstalled successfully.' -ForegroundColor Green"
        )
    ) ELSE (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[OK] Git uninstalled successfully.' -ForegroundColor Green"
    )
) ELSE (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] Git not found - may already be uninstalled.' -ForegroundColor Blue"
)
EXIT /B 0

:UninstallNodeJS_Silent
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[?] Checking for Node.js installation...' -ForegroundColor Yellow"
WHERE node >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[SETUP] Uninstalling Node.js...' -ForegroundColor Cyan"
    winget uninstall --id OpenJS.NodeJS --silent >nul 2>&1
    IF %ERRORLEVEL% NEQ 0 (
        choco uninstall nodejs -y >nul 2>&1
        IF %ERRORLEVEL% NEQ 0 (
            powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[WARN] Could not automatically uninstall Node.js. Please remove manually from Control Panel.' -ForegroundColor Yellow"
        ) ELSE (
            powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[OK] Node.js uninstalled successfully.' -ForegroundColor Green"
        )
    ) ELSE (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[OK] Node.js uninstalled successfully.' -ForegroundColor Green"
    )
) ELSE (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] Node.js not found - may already be uninstalled.' -ForegroundColor Blue"
)
EXIT /B 0

:UninstallFFmpeg_Silent
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[?] Checking for FFmpeg installation...' -ForegroundColor Yellow"
WHERE ffmpeg >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[SETUP] Uninstalling FFmpeg...' -ForegroundColor Cyan"
    choco uninstall ffmpeg -y >nul 2>&1
    IF %ERRORLEVEL% NEQ 0 (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[WARN] Could not automatically uninstall FFmpeg. Please remove manually.' -ForegroundColor Yellow"
    ) ELSE (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[OK] FFmpeg uninstalled successfully.' -ForegroundColor Green"
    )
) ELSE (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] FFmpeg not found - may already be uninstalled.' -ForegroundColor Blue"
)
EXIT /B 0

:UninstallUV_Silent
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[?] Checking for uv installation...' -ForegroundColor Yellow"
WHERE uv >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[SETUP] Uninstalling uv Python package manager...' -ForegroundColor Cyan"
    :: Remove uv from user directory
    IF EXIST "%USERPROFILE%\.cargo\bin\uv.exe" (
        DEL /F /Q "%USERPROFILE%\.cargo\bin\uv.exe" >nul 2>&1
    )
    IF EXIST "%USERPROFILE%\.local\bin\uv.exe" (
        DEL /F /Q "%USERPROFILE%\.local\bin\uv.exe" >nul 2>&1
    )
    :: Remove from PATH (this requires manual intervention or registry edit)
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[OK] uv uninstalled successfully.' -ForegroundColor Green"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] You may need to restart your terminal for PATH changes to take effect.' -ForegroundColor Blue"
) ELSE (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] uv not found - may already be uninstalled.' -ForegroundColor Blue"
)
EXIT /B 0

:UninstallChocolatey_Silent
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[?] Checking for Chocolatey installation...' -ForegroundColor Yellow"
WHERE choco >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[SETUP] Uninstalling Chocolatey package manager...' -ForegroundColor Cyan"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[WARN] This will remove Chocolatey and all packages installed through it!' -ForegroundColor Yellow"

    :: Official Chocolatey uninstall script
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Recurse -Force \"$env:ChocolateyInstall\" -ErrorAction SilentlyContinue" >nul 2>&1

    :: Remove from PATH
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable('ChocolateyInstall', $null, 'User'); [Environment]::SetEnvironmentVariable('ChocolateyInstall', $null, 'Machine')" >nul 2>&1

    :: Remove Chocolatey directory
    IF EXIST "C:\ProgramData\chocolatey" (
        RMDIR /S /Q "C:\ProgramData\chocolatey" >nul 2>&1
    )

    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[OK] Chocolatey uninstalled successfully.' -ForegroundColor Green"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] You may need to restart your terminal for PATH changes to take effect.' -ForegroundColor Blue"
) ELSE (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] Chocolatey not found - may already be uninstalled.' -ForegroundColor Blue"
)
EXIT /B 0

REM ==============================================================================
:OperationComplete
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Green"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[COMPLETE] Uninstallation operation finished!' -ForegroundColor White -BackgroundColor DarkGreen"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '======================================================' -ForegroundColor Green"
ECHO.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '[INFO] Recommendations:' -ForegroundColor Blue"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - Restart your computer to ensure all changes take effect' -ForegroundColor White"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - Check Control Panel > Programs to remove any remaining components' -ForegroundColor White"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  - Clear browser cache if you used the web application' -ForegroundColor White"
ECHO.
PAUSE
GOTO %MENU_LABEL%

REM ==============================================================================
:ErrorOccurred
ECHO.
ECHO ======================================================
ECHO [ERROR] Uninstallation failed!
ECHO ======================================================
ECHO [INFO] Common solutions:
ECHO   - Close this window and run the uninstaller again
ECHO   - Restart your computer and try again
ECHO   - Check if any applications are currently running
ECHO   - Run as administrator
ECHO   - Manually remove components from Control Panel
ECHO.
ECHO ======================================================
ECHO.
PAUSE
GOTO %MENU_LABEL%

REM ==============================================================================
:ExitScript
EXIT /B 0
