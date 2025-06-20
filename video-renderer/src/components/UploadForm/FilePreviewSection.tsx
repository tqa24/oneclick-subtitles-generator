import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  CompactFileGrid,
  CompactFilePreview,
  FileIcon,
  FileName,
  CompactFileTag,
  PreviewImage
} from './UploadForm.styles';
import {
  BsMusicNoteBeamed,
  BsFileEarmarkText
} from 'react-icons/bs';
import {
  MdVideoCameraBack
} from 'react-icons/md';
import {
  HiOutlineMicrophone
} from 'react-icons/hi';

interface FilePreviewSectionProps {
  mainAudioFile: File | null;
  narrationFile: File | null;
  lyricsFile: File | null;
}

const FilePreviewSection: React.FC<FilePreviewSectionProps> = ({
  mainAudioFile,
  narrationFile,
  lyricsFile
}) => {
  const [fileStatus, setFileStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const checkFiles = async () => {
      const status = {
        main: !!mainAudioFile,
        narration: !!narrationFile
      };
      setFileStatus(status);
    };
    checkFiles();
  }, [mainAudioFile, narrationFile]);

  return (
    <CompactFileGrid>
      {mainAudioFile && (
        <CompactFilePreview>
          <FileIcon type="Video">
            <MdVideoCameraBack />
          </FileIcon>
          <FileName>
            <span>{mainAudioFile.name}</span>
            <CompactFileTag>Video</CompactFileTag>
            {fileStatus.main && <CompactFileTag status="success">✓</CompactFileTag>}
            <FileSize>{formatFileSize(mainAudioFile.size)}</FileSize>
          </FileName>
        </CompactFilePreview>
      )}
      {narrationFile && (
        <CompactFilePreview>
          <FileIcon type="Voice">
            <HiOutlineMicrophone />
          </FileIcon>
          <FileName>
            <span>{narrationFile.name}</span>
            <CompactFileTag>Voice</CompactFileTag>
            {fileStatus.narration && <CompactFileTag status="success">✓</CompactFileTag>}
            <FileSize>{formatFileSize(narrationFile.size)}</FileSize>
          </FileName>
        </CompactFilePreview>
      )}
      {lyricsFile && (
        <CompactFilePreview>
          <FileIcon type="SRT">
            <BsFileEarmarkText />
          </FileIcon>
          <FileName>
            <span>{lyricsFile.name}</span>
            <CompactFileTag>{lyricsFile.name.endsWith('.srt') ? 'SRT' : 'JSON'}</CompactFileTag>
            <CompactFileTag status="success">✓</CompactFileTag>
            <FileSize>{formatFileSize(lyricsFile.size)}</FileSize>
          </FileName>
        </CompactFilePreview>
      )}

    </CompactFileGrid>
  );
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const FileSize = styled.span`
  font-size: 0.7rem;
  color: var(--text-secondary);
`;

export default FilePreviewSection;