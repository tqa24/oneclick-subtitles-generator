import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

// Define language types
// Added 'vi' for Vietnamese
export type Language = 'en' | 'ko' | 'vi';

// Define translations interface
// Added 'vi' property for Vietnamese translations
export interface Translations {
  [key: string]: {
    en: string;
    ko: string;
    vi: string; // Added Vietnamese
  };
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

// Create translations object
// Added Vietnamese (vi) translations for all keys
export const translations: Translations = {
  // Common
  appTitle: {
    en: 'Subtitled Video Maker',
    ko: '자막 비디오 메이커',
    vi: 'Trình tạo Video Phụ đề'
  },
  theme: {
    en: 'Theme',
    ko: '테마',
    vi: 'Chủ đề'
  },
  language: {
    en: 'Language',
    ko: '언어',
    vi: 'Ngôn ngữ'
  },
  light: {
    en: 'Light',
    ko: '라이트',
    vi: 'Sáng'
  },
  dark: {
    en: 'Dark',
    ko: '다크',
    vi: 'Tối'
  },
  english: {
    en: 'English',
    ko: '영어',
    vi: 'Tiếng Anh'
  },
  korean: {
    en: 'Korean',
    ko: '한국어',
    vi: 'Tiếng Hàn'
  },
  vietnamese: { // Added key for Vietnamese language option
    en: 'Vietnamese',
    ko: '베트남어',
    vi: 'Tiếng Việt'
  },
  clearCache: {
    en: 'Clear Cache',
    ko: '캐시 지우기',
    vi: 'Xóa bộ nhớ đệm'
  },
  note: {
    en: 'Note',
    ko: '참고',
    vi: 'Lưu ý'
  },
  videosRenderedNote: {
    en: 'Videos will be rendered in the order they are added to the queue. You can continue working while rendering happens in the background.',
    ko: '비디오는 대기열에 추가된 순서대로 렌더링됩니다. 렌더링이 백그라운드에서 진행되는 동안 계속 작업할 수 있습니다.',
    vi: 'Các video sẽ được kết xuất theo thứ tự được thêm vào hàng đợi. Bạn có thể tiếp tục làm việc trong khi quá trình kết xuất diễn ra ở chế độ nền.'
  },

  // Upload Form
  uploadFiles: {
    en: 'Upload Files',
    ko: '파일 업로드',
    vi: 'Tải lên tệp'
  },
  dragAndDropAudio: {
    en: 'Drag and drop an audio file here or click to browse',
    ko: '오디오 파일을 여기에 드래그하거나 클릭하여 찾아보기',
    vi: 'Kéo và thả tệp âm thanh vào đây hoặc nhấp để duyệt'
  },
  dragAndDropJson: {
    en: 'Drag and drop a JSON file here or click to browse',
    ko: 'JSON 파일을 여기에 드래그하거나 클릭하여 찾아보기',
    vi: 'Kéo và thả tệp JSON vào đây hoặc nhấp để duyệt'
  },
  dragAndDropImage: {
    en: 'Drag and drop an image file here or click to browse',
    ko: '이미지 파일을 여기에 드래그하거나 클릭하여 찾아보기',
    vi: 'Kéo và thả tệp hình ảnh vào đây hoặc nhấp để duyệt'
  },
  quickUpload: {
    en: 'Quick Upload',
    ko: '빠른 업로드',
    vi: 'Tải lên nhanh'
  },
  quickUploadDescription: {
    en: 'Drop all your files at once! The system will automatically detect:',
    ko: '모든 파일을 한 번에 드롭하세요! 시스템이 자동으로 감지합니다:',
    vi: 'Thả tất cả các tệp của bạn cùng một lúc! Hệ thống sẽ tự động phát hiện:'
  },
  dropAllFiles: {
    en: 'Drop All Files Here',
    ko: '여기에 모든 파일 드롭',
    vi: 'Thả tất cả tệp vào đây'
  },
  dragAndDropAll: {
    en: 'Drag and drop all your files at once for automatic categorization',
    ko: '자동 분류를 위해 모든 파일을 한 번에 드래그 앤 드롭하세요',
    vi: 'Kéo và thả tất cả các tệp của bạn cùng một lúc để phân loại tự động'
  },
  detectedFiles: {
    en: 'Detected Files:',
    ko: '감지된 파일:',
    vi: 'Các tệp đã phát hiện:'
  },
  requiredFiles: {
    en: "Note: You'll need the following files:",
    ko: '참고: 다음 파일들이 필요합니다:',
    vi: 'Lưu ý: Bạn sẽ cần các tệp sau:'
  },
  mainAudio: {
    en: 'Main Audio: ',
    ko: '메인 오디오: ',
    vi: 'Âm thanh chính: '
  },
  instrumental: {
    en: 'Instrumental: ',
    ko: '반주: ',
    vi: 'Nhạc nền: '
  },
  vocals: {
    en: 'Vocals: ',
    ko: '보컬: ',
    vi: 'Giọng hát: '
  },
  littleVocal: {
    en: 'Little Vocal: ',
    ko: '작은 보컬: ',
    vi: 'Giọng hát nhỏ: '
  },
  lyrics: {
    en: 'Lyrics: ',
    ko: '가사: ',
    vi: 'Lời bài hát: '
  },

  videoType: {
    en: 'Video Type',
    ko: '비디오 타입',
    vi: 'Loại video'
  },
  subtitledVideo: {
    en: 'Subtitled Video',
    ko: '자막 비디오',
    vi: 'Video phụ đề'
  },
  subtitledvideo: {
    en: 'Subtitled Video',
    ko: '자막 비디오',
    vi: 'Video phụ đề'
  },
  title: {
    en: 'Title',
    ko: '제목',
    vi: 'Tiêu đề'
  },
  description: {
    en: 'Description',
    ko: '설명',
    vi: 'Mô tả'
  },

  mainAudioFile: {
    en: 'Main Audio File (MP3, WAV)',
    ko: '메인 오디오 파일 (MP3, WAV)',
    vi: 'Tệp âm thanh chính (MP3, WAV)'
  },
  narrationAudio: {
    en: 'Narration Audio (Optional)',
    ko: '내레이션 오디오 (선택사항)',
    vi: 'Âm thanh thuyết minh (Tùy chọn)'
  },
  subtitlesFile: {
    en: 'Subtitles File (SRT/JSON)',
    ko: '자막 파일 (SRT/JSON)',
    vi: 'Tệp phụ đề (SRT/JSON)'
  },
  reset: {
    en: 'Reset',
    ko: '초기화',
    vi: 'Đặt lại'
  },
  audioFilesByNames: {
    en: 'Audio files based on names (containing "main", "narration", "+")',
    ko: '이름 기반 오디오 파일("main", "narration", "+" 포함)',
    vi: 'Tệp âm thanh dựa trên tên (chứa "main", "narration", "+")'
  },
  srtJsonForSubtitles: {
    en: 'SRT/JSON files for subtitles',
    ko: '자막용 SRT/JSON 파일',
    vi: 'Tệp SRT/JSON cho phụ đề'
  },

  // Render Control
  addToQueue: {
    en: 'Add Version to Queue',
    ko: '버전을 대기열에 추가',
    vi: 'Thêm phiên bản vào hàng đợi'
  },
  addAllVersions: {
    en: 'Add All Versions to Queue',
    ko: '모든 버전을 대기열에 추가',
    vi: 'Thêm tất cả phiên bản vào hàng đợi'
  },
  complete: {
    en: 'Complete',
    ko: '완료',
    vi: 'Hoàn thành'
  },

  // Queue Manager
  renderQueue: {
    en: 'Render Queue',
    ko: '렌더링 대기열',
    vi: 'Hàng đợi kết xuất'
  },
  clearQueue: {
    en: 'Clear Queue',
    ko: '대기열 지우기',
    vi: 'Xóa hàng đợi'
  },
  pending: {
    en: 'Pending',
    ko: '대기 중',
    vi: 'Đang chờ'
  },
  processing: {
    en: 'Processing',
    ko: '처리 중',
    vi: 'Đang xử lý'
  },
  completed: {
    en: 'Completed',
    ko: '완료됨',
    vi: 'Đã hoàn thành'
  },
  failed: {
    en: 'Failed',
    ko: '실패',
    vi: 'Thất bại'
  },
  remove: {
    en: 'Remove',
    ko: '제거',
    vi: 'Xóa'
  },

  // Preview
  videoPreview: {
    en: 'Video Preview',
    ko: '비디오 미리보기',
    vi: 'Xem trước video'
  },
  finalVideo: {
    en: 'Final Video',
    ko: '최종 비디오',
    vi: 'Video cuối cùng'
  },
  noVideo: {
    en: 'No video pending to render.',
    ko: '렌더링 대기 중인 비디오가 없습니다.',
    vi: 'Không có video nào đang chờ kết xuất.'
  },
  videoDetails: {
    en: 'Video Details',
    ko: '비디오 세부정보',
    vi: 'Chi tiết video'
  },
  files: {
    en: 'Files',
    ko: '파일',
    vi: 'Tệp'
  },
  previewDesc: {
    en: 'Preview will appear here after rendering',
    ko: '렌더링 후 미리보기가 여기에 표시됩니다',
    vi: 'Bản xem trước sẽ xuất hiện ở đây sau khi kết xuất'
  },
  uploadAudioFirst: {
    en: 'Please upload an audio file first',
    ko: '오디오 파일을 먼저 업로드하세요',
    vi: 'Vui lòng tải lên tệp âm thanh trước'
  },


  // Workspace
  subtitleLineThreshold: {
    en: 'Subtitle Line Threshold',
    ko: '자막 줄 임계값',
    vi: 'Ngưỡng dòng phụ đề'
  },
  adjustPreview: {
    en: 'Adjust Preview',
    ko: '미리보기 조정',
    vi: 'Điều chỉnh xem trước'
  },

  // New translations for video settings
  videoSettings: {
    en: 'Video Settings',
    ko: '비디오 설정',
    vi: 'Cài đặt video'
  },
  resolution: {
    en: 'Resolution',
    ko: '해상도',
    vi: 'Độ phân giải'
  },
  frameRate: {
    en: 'Frame Rate',
    ko: '프레임 레이트',
    vi: 'Tốc độ khung hình'
  },
  renderVideo: {
    en: 'Render Video',
    ko: '비디오 렌더링',
    vi: 'Kết xuất video'
  },

  // Slider descriptions
  resolutionDesc: {
    en: 'Choose the resolution for preview and rendering.',
    ko: '미리보기 및 렌더링을 위한 해상도를 선택합니다.',
    vi: 'Chọn độ phân giải cho xem trước và kết xuất.'
  },
  frameRateDesc: {
    en: 'Choose the frame rate for preview and rendering.',
    ko: '미리보기 및 렌더링을 위한 프레임 레이트를 선택합니다.',
    vi: 'Chọn tốc độ khung hình cho xem trước và kết xuất.'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize language from localStorage or default to 'en'
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem('language');
    // Ensure saved language is one of the valid types, otherwise default to 'en'
    if (savedLanguage && ['en', 'ko', 'vi'].includes(savedLanguage)) {
       return savedLanguage as Language;
    }
    return 'en';
  });

  // Update localStorage when language changes
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  // Translation function
  const t = (key: string): string => {
    // Check if the key exists and the translation for the current language exists
    if (translations[key] && translations[key][language]) {
      return translations[key][language];
    }
    // Fallback logic: try English, then the key itself
    if (translations[key] && translations[key]['en']) {
        console.warn(`Translation key '${key}' found, but missing translation for language '${language}'. Falling back to English.`);
        return translations[key]['en'];
    }
    // If the key doesn't exist at all
    console.warn(`Translation key not found: ${key}`);
    return key; // Return the key as a fallback
  };


  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};