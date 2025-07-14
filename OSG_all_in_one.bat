@ECHO OFF
CLS

:: --- Configuration ---
SET "PROJECT_FOLDER_NAME=oneclick-subtitles-generator"
SET "GIT_REPO_URL=https://github.com/nganlinh4/oneclick-subtitles-generator.git"
SET "SCRIPT_DIR=%~dp0"
SET "PROJECT_PATH=%SCRIPT_DIR%%PROJECT_FOLDER_NAME%"
IF "%PROJECT_PATH:~-1%"=="\" SET "PROJECT_PATH=%PROJECT_PATH:~0,-1%"

:: --- Fixed Settings (Vietnamese Menu) ---
SET "MENU_LABEL=MainMenuVI"
SET "PROMPT_CHOICE=Nhap lua chon cua ban (1-7): "
SET "TITLE_TEXT=Quan Ly Trinh Tao Phu De OneClick"

TITLE %TITLE_TEXT%

:: --- Check for Administrator Privileges ---
ECHO Dang kiem tra quyen quan tri vien...
net session >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO ======================================================
    ECHO LOI: Yeu cau quyen quan tri vien.
    ECHO Dang yeu cau quyen quan tri vien...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    EXIT /B
)
ECHO Da xac nhan quyen quan tri vien.
ECHO.

GOTO %MENU_LABEL%

:: =============================================================================
:: VIETNAMESE MENU (Hardcoded)
:: =============================================================================
:MainMenuVI
CLS
ECHO ======================================================
ECHO %TITLE_TEXT%
ECHO Vi tri (Location): %SCRIPT_DIR%
ECHO Thu muc Du an (Project Folder): %PROJECT_FOLDER_NAME%
ECHO ======================================================
ECHO Vui long chon mot tuy chon:
ECHO.
ECHO CAI DAT / THIET LAP:
ECHO   1. Cai dat (Thuyet minh thong thuong + Long tieng nhan ban giong noi) (Install with Gemini + F5-TTS Narration)
ECHO      (Luu y: Se ton nhieu dung luong luu tru hon, tren Windows chi ho tro GPU cua NVIDIA va Intel)
ECHO   2. Cai dat (Thuyet minh thong thuong) (Install with Gemini Narration)
ECHO.
ECHO BAO TRI / SU DUNG:
ECHO   3. Cap nhat Ung dung (Update)
ECHO   4. Chay Ung dung (Run App)
ECHO   5. Chay Ung dung voi Nhan ban giong noi (Run App with F5-TTS Narration)
ECHO.
ECHO GO CAI DAT:
ECHO   6. Go cai dat Ung dung (Uninstall)
ECHO.
ECHO   7. Thoat (Exit)
ECHO ======================================================
ECHO.
SET /P "CHOICE=%PROMPT_CHOICE%"

:: Validate input
IF NOT "%CHOICE%"=="" SET CHOICE=%CHOICE:~0,1%
IF "%CHOICE%"=="1" GOTO InstallNarration
IF "%CHOICE%"=="2" GOTO InstallNoNarration
IF "%CHOICE%"=="3" GOTO UpdateApp
IF "%CHOICE%"=="4" GOTO RunApp
IF "%CHOICE%"=="5" GOTO RunAppCUDA
IF "%CHOICE%"=="6" GOTO UninstallApp
IF "%CHOICE%"=="7" GOTO ExitScript

ECHO Lua chon khong hop le. Vui long thu lai.
TIMEOUT /T 2 /NOBREAK > NUL
GOTO %MENU_LABEL%

REM ==============================================================================
:InstallNarration
ECHO *** Tuy chon 1: Cai dat (Thuyet minh thong thuong + Long tieng nhan ban giong noi) (Option 1: Install with Gemini + F5-TTS Narration) ***

CALL :InstallPrerequisites
IF %ERRORLEVEL% NEQ 0 GOTO ErrorOccurred

CALL :CleanInstall "%PROJECT_PATH%"
IF %ERRORLEVEL% NEQ 0 GOTO ErrorOccurred

ECHO Cloning repository from %GIT_REPO_URL%...
git clone %GIT_REPO_URL% "%PROJECT_PATH%"
IF %ERRORLEVEL% NEQ 0 (
    ECHO ERROR: Failed to clone repository.
    GOTO ErrorOccurred
)

ECHO Changing directory to "%PROJECT_PATH%"
PUSHD "%PROJECT_PATH%"
IF %ERRORLEVEL% NEQ 0 (
    ECHO ERROR: Failed to change directory to project folder.
    POPD
    GOTO ErrorOccurred
)

ECHO Installing dependencies (using npm run install:all)...
CALL npm run install:all
IF %ERRORLEVEL% NEQ 0 (
    ECHO ERROR: Failed during 'npm run install:all'. Check messages above.
    POPD
    GOTO ErrorOccurred
)

ECHO Installing yt-dlp for YouTube video downloads...
CALL npm run install:yt-dlp
IF %ERRORLEVEL% NEQ 0 (
    ECHO WARNING: Failed to install yt-dlp. YouTube downloads might have issues.
    ECHO You can try installing it manually later with 'npm run install:yt-dlp'.
)

ECHO Cai dat hoan tat. Dang khoi chay ung dung voi CUDA...
ECHO (Requires NVIDIA GPU and CUDA Toolkit installed separately)
ECHO Nhan Ctrl+C trong cua so nay de dung ung dung sau.
CALL npm run dev:cuda
POPD
GOTO %MENU_LABEL%

REM ==============================================================================
:InstallNoNarration
ECHO *** Tuy chon 2: Cai dat (Thuyet minh thong thuong) (Option 2: Install with Gemini Narration) ***

CALL :InstallPrerequisites
IF %ERRORLEVEL% NEQ 0 GOTO ErrorOccurred

CALL :CleanInstall "%PROJECT_PATH%"
IF %ERRORLEVEL% NEQ 0 GOTO ErrorOccurred

ECHO Cloning repository from %GIT_REPO_URL%...
git clone %GIT_REPO_URL% "%PROJECT_PATH%"
IF %ERRORLEVEL% NEQ 0 (
    ECHO ERROR: Failed to clone repository.
    GOTO ErrorOccurred
)

ECHO Changing directory to "%PROJECT_PATH%"
PUSHD "%PROJECT_PATH%"
IF %ERRORLEVEL% NEQ 0 (
    ECHO ERROR: Failed to change directory to project folder.
    POPD
    GOTO ErrorOccurred
)

ECHO Installing dependencies (using npm install)...
CALL npm install
IF %ERRORLEVEL% NEQ 0 (
    ECHO ERROR: Failed during 'npm install'. Check messages above.
    POPD
    GOTO ErrorOccurred
)

ECHO Installing yt-dlp for YouTube video downloads...
CALL npm run install:yt-dlp
IF %ERRORLEVEL% NEQ 0 (
    ECHO WARNING: Failed to install yt-dlp. YouTube downloads might have issues.
    ECHO You can try installing it manually later with 'npm run install:yt-dlp'.
)

ECHO Cai dat hoan tat. Dang khoi chay ung dung...
ECHO Nhan Ctrl+C trong cua so nay de dung ung dung sau.
CALL npm run dev
POPD
GOTO %MENU_LABEL%

REM ==============================================================================
:UpdateApp
ECHO *** Tuy chon 3: Cap nhat Ung dung (Option 3: Update) ***
IF NOT EXIST "%PROJECT_PATH%\.git" (
    ECHO LOI: Thu muc du an "%PROJECT_PATH%" khong tim thay hoac khong phai la kho git.
    ECHO Vui long su dung mot trong cac tuy chon Cai dat truoc.
    GOTO ErrorOccurred
)

ECHO Changing directory to "%PROJECT_PATH%"
PUSHD "%PROJECT_PATH%"
IF %ERRORLEVEL% NEQ 0 (
    ECHO ERROR: Failed to change directory to project folder.
    POPD
    GOTO ErrorOccurred
)

ECHO Pulling latest changes from repository...
git reset --hard origin/main
git pull
uv pip install --python .venv --upgrade yt-dlp
IF %ERRORLEVEL% NEQ 0 (
    ECHO ERROR: Failed to pull updates using 'git pull' or 'uv pip install --python .venv --upgrade yt-dlp'. Check messages above.
    POPD
    GOTO ErrorOccurred
)
ECHO Kiem tra cap nhat hoan tat.
POPD

ECHO.
SET /P "INSTALL_DEPS=Chay 'npm install' ngay bay gio trong truong hop cac phu thuoc da thay doi? (c/k): "
IF /I "%INSTALL_DEPS%"=="c" (
    ECHO Changing directory to "%PROJECT_PATH%"
    PUSHD "%PROJECT_PATH%"
    IF %ERRORLEVEL% NEQ 0 (
        ECHO ERROR: Failed to change directory to project folder for npm install.
        GOTO ErrorOccurred
    )
    ECHO Running 'npm install'...
    CALL npm install
     IF %ERRORLEVEL% NEQ 0 (
        ECHO WARNING: 'npm install' encountered errors. Check messages above.
    ) ELSE (
        ECHO 'npm install' completed.
    )
	PAUSE
    POPD
)

GOTO %MENU_LABEL%

REM ==============================================================================
:RunApp
ECHO *** Tuy chon 4: Chay Ung dung (Option 4: Run App) ***
IF NOT EXIST "%PROJECT_PATH%\package.json" (
    ECHO LOI: Thu muc du an "%PROJECT_PATH%" hoac package.json khong tim thay.
    ECHO Vui long su dung mot trong cac tuy chon Cai dat truoc.
    GOTO ErrorOccurred
)

ECHO Changing directory to "%PROJECT_PATH%"
PUSHD "%PROJECT_PATH%"
IF %ERRORLEVEL% NEQ 0 (
    ECHO ERROR: Failed to change directory to project folder.
    POPD
    GOTO ErrorOccurred
)

ECHO Dang khoi chay ung dung (using npm run dev)...
ECHO Nhan Ctrl+C trong cua so nay de dung ung dung sau.
CALL npm run dev
IF %ERRORLEVEL% NEQ 0 (
    ECHO ERROR: Failed to start application using 'npm run dev'. Check messages above.
    POPD
    GOTO ErrorOccurred
)
POPD
GOTO %MENU_LABEL%

REM ==============================================================================
:RunAppCUDA
ECHO *** Tuy chon 5: Chay Ung dung voi Nhan ban giong noi (Option 5: Run App with F5-TTS Narration) ***
IF NOT EXIST "%PROJECT_PATH%\package.json" (
    ECHO LOI: Thu muc du an "%PROJECT_PATH%" hoac package.json khong tim thay.
    ECHO Vui long su dung mot trong cac tuy chon Cai dat truoc.
    GOTO ErrorOccurred
)

ECHO Changing directory to "%PROJECT_PATH%"
PUSHD "%PROJECT_PATH%"
IF %ERRORLEVEL% NEQ 0 (
    ECHO ERROR: Failed to change directory to project folder.
    POPD
    GOTO ErrorOccurred
)

ECHO Dang khoi chay ung dung voi CUDA (using npm run dev:cuda)...
ECHO Luu y: Yeu cau GPU NVIDIA tuong thich va CUDA Toolkit da duoc cai dat.
ECHO Nhan Ctrl+C trong cua so nay de dung ung dung sau.
CALL npm run dev:cuda
IF %ERRORLEVEL% NEQ 0 (
    ECHO ERROR: Failed to start application using 'npm run dev:cuda'. Check messages above.
    POPD
    GOTO ErrorOccurred
)
POPD
GOTO %MENU_LABEL%

REM ==============================================================================
:UninstallApp
ECHO *** Tuy chon 6: Go cai dat Ung dung (Option 6: Uninstall) ***
IF NOT EXIST "%PROJECT_PATH%" (
    ECHO THONG TIN: Thu muc du an "%PROJECT_PATH%" khong tim thay. Ung dung co the chua duoc cai dat.
    GOTO ErrorOccurred
)

ECHO CANH BAO: Hanh dong nay se xoa vinh vien thu muc du an va tat ca noi dung cua no:
ECHO %PROJECT_PATH%
ECHO.
SET /P "CONFIRM_UNINSTALL=Ban co chac chan muon tiep tuc go cai dat? (c/k): "
IF /I NOT "%CONFIRM_UNINSTALL%"=="c" (
    ECHO Da huy go cai dat.
    GOTO %MENU_LABEL%
)

ECHO Dang xoa thu muc du an: %PROJECT_PATH%...
RMDIR /S /Q "%PROJECT_PATH%"
IF %ERRORLEVEL% NEQ 0 (
    ECHO LOI: Khong the xoa thu muc du an. Kiem tra quyen hoac tap tin co dang duoc su dung khong.
    GOTO ErrorOccurred
)

ECHO Go cai dat hoan tat. Thu muc du an da duoc xoa.
GOTO %MENU_LABEL%

REM ==============================================================================
:: Subroutine: Install Prerequisites (Choco, Git, Node, FFmpeg, uv)
:InstallPrerequisites
ECHO --- Dang kiem tra/cai dat cac dieu kien tien quyet ---

ECHO Configuring PowerShell settings for downloads...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072;" > nul
IF %ERRORLEVEL% NEQ 0 (
    ECHO Failed to set PowerShell security protocol.
    EXIT /B 1
)

ECHO Checking/Installing Chocolatey...
WHERE choco >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    ECHO Chocolatey not found. Installing...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    IF %ERRORLEVEL% NEQ 0 (
        ECHO Failed to install Chocolatey.
        EXIT /B 1
    )
    ECHO Chocolatey installation command executed. Verifying after delay...
    timeout /t 5 /nobreak > nul
    WHERE choco >nul 2>nul
    IF %ERRORLEVEL% NEQ 0 (
       ECHO ERROR: choco command still not found after installation attempt.
       EXIT /B 1
   )
) ELSE (
    ECHO Chocolatey already installed.
)

ECHO Checking/Installing Git...
WHERE git >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    ECHO Git not found. Installing using Winget...
    winget install --id Git.Git -e --source winget
    IF %ERRORLEVEL% NEQ 0 (
        ECHO Winget failed to install Git. Trying with Chocolatey...
        choco install git -y
        IF %ERRORLEVEL% NEQ 0 (
            ECHO ERROR: Failed to install Git with both Winget and Chocolatey.
            EXIT /B 1
        )
    )
    REFRESHENV
) ELSE (
    ECHO Git already installed.
)

ECHO Checking/Installing Node.js LTS...
WHERE node >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    ECHO Node.js not found. Installing using winget...
    winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements -s winget
     IF %ERRORLEVEL% NEQ 0 (
      ECHO ERROR: Failed to install Node.js LTS via winget. Trying Chocolatey as fallback...
      choco install nodejs-lts -y
      IF %ERRORLEVEL% NEQ 0 (
          ECHO ERROR: Failed to install Node.js LTS via Chocolatey as well.
          EXIT /B 1
      )
    )
    REFRESHENV
) ELSE (
    ECHO Node.js already installed.
)

ECHO Checking/Installing FFmpeg...
WHERE ffmpeg >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    ECHO FFmpeg not found. Installing using Chocolatey...
    choco install ffmpeg -y
    IF %ERRORLEVEL% NEQ 0 (
      ECHO WARNING: Failed to install FFmpeg. Application might have issues.
    )
    REFRESHENV
) ELSE (
    ECHO FFmpeg already installed.
)

:: ***** ADDED UV INSTALLATION *****
ECHO Checking/Installing uv...
WHERE uv >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    ECHO uv not found. Installing...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex"
    IF %ERRORLEVEL% NEQ 0 (
        ECHO ERROR: Failed to install uv. Check messages above.
        ECHO It might be necessary to manually install it from https://astral.sh/uv
        EXIT /B 1
    )
    ECHO uv installation command executed.
    ECHO NOTE: You might need to restart this script or your terminal for the 'uv' command to be available in the PATH.
) ELSE (
    ECHO uv already installed.
)
:: *********************************

ECHO Resetting PowerShell Execution Policy for Current User to RemoteSigned...
powershell -NoProfile -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force" > nul

ECHO --- Kiem tra/Cai dat Dieu kien Tien quyet Hoan tat ---
ECHO.
EXIT /B 0
:: End of InstallPrerequisites Subroutine

REM ==============================================================================
:: Subroutine: Clean Install - Removes existing project folder (Modified: No Confirmation)
:CleanInstall
SET "FOLDER_TO_CLEAN=%~1"
ECHO Dang kiem tra thu muc hien co: %FOLDER_TO_CLEAN%
IF EXIST "%FOLDER_TO_CLEAN%" (
    ECHO CANH BAO: Tim thay thu muc du an hien co. No se bi XOA de thuc hien cai dat sach.
    ECHO Dang xoa thu muc hien co: %FOLDER_TO_CLEAN%...
    RMDIR /S /Q "%FOLDER_TO_CLEAN%"
    IF %ERRORLEVEL% NEQ 0 (
        ECHO LOI: Khong the xoa thu muc hien co "%FOLDER_TO_CLEAN%".
        ECHO Kiem tra quyen hoac xem co tap tin/thu muc nao dang duoc su dung khong.
        EXIT /B 1
    )
    ECHO Thu muc da duoc xoa thanh cong.
) ELSE (
    ECHO Khong tim thay thu muc hien co "%FOLDER_TO_CLEAN%". Tiep tuc voi viec sao chep kho moi.
)
EXIT /B 0
:: End of CleanInstall Subroutine

REM ==============================================================================
:ErrorOccurred
ECHO.
ECHO ********** Da xay ra loi. Vui long xem lai cac thong bao ben tren. (ERROR OCCURED, OPEN THE BAT FILE AND INSTALL AGAIN MAY HELP) **********
ECHO Vui long tat di mo lai file bat va bam cai dat lan nua moi khi co loi,
ECHO vi system PATH cho Chocolatey, Git, Node, FFmpeg, uv can duoc cap nhat lai.
ECHO.
PAUSE
GOTO %MENU_LABEL% :: <<<<< Changed this line from GOTO %MENU_LABEL%

:ExitScript
EXIT /B 0
