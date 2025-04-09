!macro customInstall
  ; Check if FFmpeg is already installed
  nsExec::ExecToStack 'where ffmpeg'
  Pop $0
  Pop $1
  ${If} $0 != 0
    ; FFmpeg not found, install it using winget
    DetailPrint "FFmpeg not found. Installing FFmpeg..."
    DetailPrint "This may take a few minutes. Please wait..."
    nsExec::ExecToStack 'powershell.exe -Command "winget install --id Gyan.FFmpeg -e --source winget --accept-package-agreements --accept-source-agreements"'
    Pop $0
    Pop $1
    ${If} $0 != 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to install FFmpeg. You may need to install it manually. Visit https://ffmpeg.org/download.html for instructions."
    ${Else}
      DetailPrint "FFmpeg installed successfully."
    ${EndIf}
  ${Else}
    DetailPrint "FFmpeg is already installed."
  ${EndIf}
!macroend
