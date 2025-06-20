import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  FormContainer,
  Section,
  InfoBox,
  Button,
  ErrorMessage,
  FormGridWide,
  DropZone,
  DropText
} from './UploadForm.styles';
import { UploadFormProps } from './UploadForm.types';
import { useUploadFormHandlers } from './UploadForm.hooks';
import FilePreviewSection from './FilePreviewSection';
import FileUploadSection from './FileUploadSection';

const UploadForm: React.FC<UploadFormProps> = ({
  onFilesChange,
  onVideoPathChange,
  initialValues
}) => {
  const { t } = useLanguage();
  const {
    mainAudioFile,
    narrationFile,
    lyrics,
    lyricsFile,
    error,
    isDragging,
    videoPath,
    mainAudioInputRef,
    narrationInputRef,
    lyricsInputRef,
    handleAudioChange,
    handleLyricsChange,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleBulkDrop,
    resetForm
  } = useUploadFormHandlers(initialValues, onFilesChange, onVideoPathChange);

  return (
    <FormContainer>
      <InfoBox>
        <strong>Quick Upload:</strong> Drop all your files at once to automatically detect and organize them
      </InfoBox>

      <Section>
        <h3>Required Files</h3>
        <InfoBox>Upload your video, narration audio, and SRT subtitle file</InfoBox>
        <DropZone
          isDragging={isDragging['bulk']}
          onDrop={handleBulkDrop}
          onDragOver={handleDragOver}
          onDragEnter={(e: React.DragEvent<HTMLDivElement>) => handleDragEnter(e, 'bulk')}
          onDragLeave={(e: React.DragEvent<HTMLDivElement>) => handleDragLeave(e, 'bulk')}
        >
          <DropText>
            <strong>Drop all files here</strong>
            <br />
            Drag and drop your video, narration, and SRT file
          </DropText>
          {(mainAudioFile || narrationFile || lyricsFile) && (
            <div style={{ marginTop: '0.75rem', width: '100%' }}>
              <h4>Detected Files</h4>
              <FilePreviewSection
                mainAudioFile={mainAudioFile}
                narrationFile={narrationFile}
                lyricsFile={lyricsFile}
              />
            </div>
          )}
        </DropZone>
      </Section>

      <Section>
        <FormGridWide>
          <FileUploadSection
            label="Video with Audio"
            dropText="Drag and drop video file"
            isDragging={isDragging['main']}
            file={mainAudioFile}
            inputRef={mainAudioInputRef as React.RefObject<HTMLInputElement>}
            accept="video/*,audio/*"
            onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDrop(e, 'main')}
            onDragOver={handleDragOver}
            onDragEnter={(e: React.DragEvent<HTMLDivElement>) => handleDragEnter(e, 'main')}
            onDragLeave={(e: React.DragEvent<HTMLDivElement>) => handleDragLeave(e, 'main')}
            onClick={() => mainAudioInputRef.current?.click()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAudioChange(e, 'main')}
            tag="Video"
          />

          <FileUploadSection
            label="Narration Audio"
            dropText="Drag and drop narration audio"
            isDragging={isDragging['narration']}
            file={narrationFile}
            inputRef={narrationInputRef as React.RefObject<HTMLInputElement>}
            accept="audio/*"
            onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDrop(e, 'narration')}
            onDragOver={handleDragOver}
            onDragEnter={(e: React.DragEvent<HTMLDivElement>) => handleDragEnter(e, 'narration')}
            onDragLeave={(e: React.DragEvent<HTMLDivElement>) => handleDragLeave(e, 'narration')}
            onClick={() => narrationInputRef.current?.click()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAudioChange(e, 'narration')}
            tag="Voice"
          />
        </FormGridWide>

        <FormGridWide>
          <FileUploadSection
            label="Subtitles File"
            dropText="Drag and drop SRT or JSON file"
            isDragging={isDragging['lyrics']}
            file={lyricsFile}
            inputRef={lyricsInputRef as React.RefObject<HTMLInputElement>}
            accept=".srt,.json"
            onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDrop(e, 'lyrics')}
            onDragOver={handleDragOver}
            onDragEnter={(e: React.DragEvent<HTMLDivElement>) => handleDragEnter(e, 'lyrics')}
            onDragLeave={(e: React.DragEvent<HTMLDivElement>) => handleDragLeave(e, 'lyrics')}
            onClick={() => lyricsInputRef.current?.click()}
            onChange={handleLyricsChange}
            tag="SRT"
          />
        </FormGridWide>
      </Section>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <Button
          type="button"
          onClick={resetForm}
          style={{ background: '#f44336' }}
        >
          Reset
        </Button>
      </div>

      {error && <ErrorMessage>{error}</ErrorMessage>}
    </FormContainer>
  );
};

export default UploadForm;
