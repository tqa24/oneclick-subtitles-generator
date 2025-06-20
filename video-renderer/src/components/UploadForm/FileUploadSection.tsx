import React from 'react';
import { BsFileEarmarkText, BsMusicNoteBeamed } from 'react-icons/bs';
import styled from 'styled-components';
import { 
  DropZone, 
  DropText, 
  FileName, 
  CompactFileTag,
  FileIcon,
  PreviewImage 
} from './UploadForm.styles';

interface FileUploadSectionProps {
  label: string;
  h3?: string;
  h4?: string;
  h5?: string;
  dropText: string;
  isDragging: boolean;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement>;
  accept: string;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onClick: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isImage?: boolean;
  tag?: string;
}



const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  label,
  dropText,
  isDragging,
  
  file,
  inputRef,
  accept,
  onDrop,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onClick,
  onChange,
  isImage = false,
  tag
}) => {
  return (
    <div>
      <DropZone
        isDragging={isDragging}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onClick={onClick}
      >
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>{label}</h4>
        <DropText>{dropText}</DropText>
        
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file" 
          accept={accept} 
          onChange={onChange}
          style={{ display: 'none' }}
        />
        
        {file && (
          <div style={{ marginTop: '0.5rem' }}>
            {isImage ? (
              <PreviewImage 
                src={URL.createObjectURL(file)} 
                alt={label} 
              />
            ) : (
              <FileIcon type={tag || ''}>
                {tag === 'JSON' ? <BsFileEarmarkText /> : <BsMusicNoteBeamed />}
              </FileIcon>
            )}
            
            <FileName>
              <span>{file.name}</span>
              {tag && <CompactFileTag>{tag}</CompactFileTag>}
            </FileName>
          </div>
        )}
      </DropZone>
    </div>
  );
};

export default FileUploadSection;