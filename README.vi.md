# Phần Mềm Tạo Phụ Đề Tự Động

Phần mềm web giúp tạo phụ đề có thời gian chính xác cho video bằng công nghệ AI Gemini của Google.

## Hướng Dẫn Cài Đặt Nhanh

![Giới thiệu ứng dụng](readme_assets/Screenshot%202025-04-12%20213110e.png)

### Cài Đặt Trên Windows

#### 1. Chuẩn Bị

- Tải và giải nén zip từ GitHub
- Mở PowerShell với quyền Administrator (Windows + X, chọn PowerShell Admin)

#### 2. Cài Đặt 

```powershell
# Cài đặt Chocolatey, FFmpeg, Node.js và Cho phép chạy script
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
choco install ffmpeg -y
winget install OpenJS.NodeJS.LTS
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force


```

Đóng và mở lại PowerShell sau khi cài đặt Node.js.

### Cài Đặt Trên macOS

```bash
# Cài đặt Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Cài đặt Node.js và FFmpeg
brew install node ffmpeg
```

### Cài Đặt Ứng Dụng

```bash
cd đường-dẫn-đến-thư-mục-giải-nén
npm install
npm run dev
```

Trình duyệt sẽ tự động mở tại http://localhost:3005

