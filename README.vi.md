# Phần Mềm Tạo Phụ Đề Tự Động

Phần mềm web giúp auto-sub cho video, audio, dịch SRT, thuyết minh, tạo hình nền, render video phù hợp với người dùng phổ thông.

## Hướng Dẫn Cài Đặt Nhanh

### Cài Đặt Trên Windows

- Vào mục [Releases](https://github.com/nganlinh4/oneclick-subtitles-generator/releases) tải về OSG_installer_Windows.bat phiên bản mới nhất.

- Mở file .bat vừa tải và làm theo hướng dẫn (kích thước app sẽ lớn nếu cài với tính năng clone giọng)

### Cài Đặt Trên macOS và Ubuntu

- Clone repo này về máy + chạy file OSG_installer.sh:
  ```bash
  git clone https://github.com/nganlinh4/oneclick-subtitles-generator.git
  cd oneclick-subtitles-generator
  chmod +x OSG_installer.sh
  ./OSG_installer.sh
  ```

- Làm theo hướng dẫn trên màn hình (kích thước app sẽ lớn nếu cài với tính năng clone giọng)

### Cập Nhật hoặc Chạy Ứng Dụng

#### Windows
- Mở OSG_installer_Windows.bat và làm theo hướng dẫn.

#### macOS và Ubuntu
- Mở Terminal và chạy lại file OSG_installer.sh:
  ```bash
  ./OSG_installer.sh
  ```

- Trình duyệt sẽ tự động mở tại http://localhost:3030

## So Sánh Các Chế Độ Chạy

OSG hiện chỉ có một bản cài local. Các engine nặng như F5-TTS, Chatterbox và NVIDIA Parakeet được cài theo nhu cầu trong Settings > Voice & transcription engines.

| Tính Năng | OSG Local | OSG Vercel |
|---------|-----------|------------|
| **Tạo Phụ Đề AI** | ✅ Gemini + Parakeet nếu đã cài | ✅ Gemini AI transcription |
| **Nguồn Video** | ✅ YouTube, Douyin/TikTok, 1000+ nền tảng + Tải lên | Chỉ tải lên |
| **Trình Chỉnh Sửa Phụ Đề** | ✅ Timeline trực quan, sóng âm, xem trước thực tế | ✅ Timeline trực quan, sóng âm, xem trước thực tế |
| **Dịch Thuật** | ✅ Đa ngôn ngữ với nhận thức ngữ cảnh | ✅ Đa ngôn ngữ với nhận thức ngữ cảnh |
| **Render Video** | ✅ GPU-accelerated với Remotion | ❌ Không có sẵn |
| **Tạo Nhạc Nền** | ✅ Nhạc AI với Lyria | ✅ Nhạc AI với Lyria |
| **TTS Cơ Bản** | ✅ Gemini Live API, Edge TTS, Google TTS | ❌ Không có sẵn |
| **Clone Giọng** | ✅ F5-TTS, Chatterbox nếu đã cài | ❌ Không có sẵn |
| **Kích Thước Thư Mục Dự Án** | Nhỏ sau cài base; tăng thêm khi cài engine local | N/A (hosted) |
| **Yêu Cầu GPU** | GPU giúp render và engine local nhanh hơn; CPU fallback có sẵn | Không (không có render/local engine) |

### 💡 **Khuyến Nghị:**
- **Chạy OSG local** nếu bạn cần tải video, render, TTS hoặc engine local
- **Dùng OSG Vercel** nếu bạn chỉ cần workflow hosted dựa trên Gemini
