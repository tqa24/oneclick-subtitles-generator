import React from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentsIcon, VideoAnalysisIcon, OptimizationIcon, DisplayIcon } from '../icons/TabIcons';

const VideoProcessingTab = ({
  segmentDuration,
  setSegmentDuration,
  geminiModel,
  setGeminiModel,
  timeFormat,
  setTimeFormat,
  showWaveform,
  setShowWaveform,
  useVideoAnalysis,
  videoAnalysisModel,
  setVideoAnalysisModel,
  videoAnalysisTimeout,
  setVideoAnalysisTimeout,
  autoSelectDefaultPreset,
  setAutoSelectDefaultPreset,
  optimizeVideos,
  optimizedResolution,
  setOptimizedResolution,
  useOptimizedPreview,
  setUseOptimizedPreview
}) => {
  const { t } = useTranslation();

  return (
    <div className="settings-section video-processing-section">

      {/* Grid layout for settings cards */}
      <div className="video-processing-grid">
        {/* Combined Segments and AI Model Card */}
        <div className="settings-card combined-card">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <SegmentsIcon />
            </div>
            <h4>{t('settings.processingSettings', 'Processing Settings')}</h4>
          </div>
          <div className="settings-card-content">
            {/* Segment Duration Setting */}
            <div className="compact-setting">
              <label htmlFor="segment-duration">
                {t('settings.segmentDuration', 'Segment Duration (minutes)')}
              </label>
              <p className="setting-description">
                {t('settings.segmentDurationDescription', 'Choose how long each video segment should be when processing long videos. Shorter segments process faster but may be less accurate.')}
              </p>
              <select
                id="segment-duration"
                value={segmentDuration}
                onChange={(e) => setSegmentDuration(parseInt(e.target.value))}
                className="enhanced-select"
              >
                <option value="1">1 {t('settings.minutes', 'minutes')}</option>
                <option value="2">2 {t('settings.minutes', 'minutes')}</option>
                <option value="3">3 {t('settings.minutes', 'minutes')}</option>
                <option value="5">5 {t('settings.minutes', 'minutes')}</option>
                <option value="10">10 {t('settings.minutes', 'minutes')}</option>
                <option value="15">15 {t('settings.minutes', 'minutes')}</option>
                <option value="20">20 {t('settings.minutes', 'minutes')}</option>
                <option value="30">30 {t('settings.minutes', 'minutes')}</option>
                <option value="45">45 {t('settings.minutes', 'minutes')}</option>
              </select>
            </div>

            {/* Gemini Model Setting */}
            <div className="compact-setting">
              <label htmlFor="gemini-model">
                {t('settings.geminiModel', 'Gemini Model')}
              </label>
              <p className="setting-description">
                {t('settings.geminiModelDescription', 'Select the Gemini model to use for transcription. Different models offer trade-offs between accuracy and speed.')}
              </p>
              <select
                id="gemini-model"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="enhanced-select"
              >
                <option value="gemini-2.5-pro-exp-03-25">
                  {t('settings.modelBestAccuracy', 'Gemini 2.5 Pro (Best accuracy, slowest, easily overloaded)')}
                </option>
                <option value="gemini-2.5-flash-preview-05-20">
                  {t('settings.modelSmartFast', 'Gemini 2.5 Flash (Smarter & faster, second best accuracy)')}
                </option>
                <option value="gemini-2.0-flash">
                  {t('settings.modelThirdBest', 'Gemini 2.0 Flash (Third best, acceptable accuracy, medium speed)')}
                </option>
                <option value="gemini-2.0-flash-lite">
                  {t('settings.modelFastest', 'Gemini 2.0 Flash Lite (Worst accuracy, fastest - testing only)')}
                </option>
              </select>
            </div>
          </div>
        </div>


        {/* Video Analysis Card */}
        <div className="settings-card analysis-card">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <VideoAnalysisIcon />
            </div>
            <h4>{t('settings.videoAnalysisSection', 'Video Analysis')}</h4>
          </div>
          <div className="settings-card-content">
            {/* Hidden: Preset Detect + Context Memory/Rules setting */}

            <div className="compact-setting">
              <label htmlFor="video-analysis-model">
                {t('settings.videoAnalysisModel', 'Analysis Model')}
              </label>
              <p className="setting-description">
                {t('settings.videoAnalysisModel.simplified', 'Select the model to use for video analysis. Flash Lite is faster but less accurate.')}
              </p>
              <select
                id="video-analysis-model"
                value={videoAnalysisModel}
                onChange={(e) => setVideoAnalysisModel(e.target.value)}
                className="enhanced-select"
                disabled={!useVideoAnalysis}
              >
                <option value="gemini-2.5-flash-preview-05-20">{t('settings.modelFlash25', 'Gemini 2.5 Flash (Best)')}</option>
                <option value="gemini-2.0-flash">{t('settings.modelFlash', 'Gemini 2.0 Flash (More Detailed)')}</option>
                <option value="gemini-2.0-flash-lite">{t('settings.modelFlashLite', 'Gemini 2.0 Flash Lite (Faster)')}</option>
              </select>
            </div>

            <div className="compact-setting">
              <label htmlFor="video-analysis-timeout">
                {t('settings.videoAnalysisTimeout', 'Analysis Timeout')}
              </label>
              <p className="setting-description">
                {t('settings.videoAnalysisTimeout.simplified', 'Maximum time to wait for video analysis results before proceeding with default settings.')}
              </p>
              <select
                id="video-analysis-timeout"
                value={videoAnalysisTimeout}
                onChange={(e) => setVideoAnalysisTimeout(e.target.value)}
                className="enhanced-select"
                disabled={!useVideoAnalysis}
              >
                <option value="none">{t('settings.timeoutNone', 'No Timeout')}</option>
                <option value="10">{t('settings.timeout10Seconds', '10 Seconds')}</option>
                <option value="20">{t('settings.timeout20Seconds', '20 Seconds')}</option>
              </select>
            </div>

            <div className="compact-setting">
              <div className="setting-header">
                <label htmlFor="auto-select-default-preset">
                  {t('settings.autoSelectDefaultPreset', 'Auto-select default preset on timeout')}
                </label>
                <div className="toggle-switch-container">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      id="auto-select-default-preset"
                      checked={autoSelectDefaultPreset}
                      onChange={(e) => setAutoSelectDefaultPreset(e.target.checked)}
                      disabled={!useVideoAnalysis}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <p className="setting-description">
                {t('settings.autoSelectDefaultPresetDescription', "If enabled, the 'Use My Default Preset' option will be automatically selected in the Video Analysis Results pop-up when the timer expires. Otherwise, the 'Use Recommended' preset will be selected.")}
              </p>
            </div>
          </div>
        </div>

        {/* Video Optimization Card */}
        <div className="settings-card optimization-card">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <OptimizationIcon />
            </div>
            <h4>{t('settings.videoOptimizationSection', 'Video Optimization')}</h4>
          </div>
          <div className="settings-card-content">
            {/* Hidden: Automatically optimize uploaded videos setting */}

            <div className="compact-setting">
              <label htmlFor="optimized-resolution">
                {t('settings.optimizedResolution', 'Optimized Resolution')}
              </label>
              <p className="setting-description">
                {t('settings.optimizedResolutionDescription', 'Select the resolution to use for optimized videos. Lower resolutions process faster but may reduce accuracy.')}
              </p>
              <select
                id="optimized-resolution"
                value={optimizedResolution}
                onChange={(e) => setOptimizedResolution(e.target.value)}
                className="enhanced-select"
                disabled={!optimizeVideos}
              >
                <option value="240p">240p</option>
                <option value="360p">360p</option>
              </select>
            </div>

            <div className="compact-setting">
              <div className="setting-header">
                <label htmlFor="use-optimized-preview">
                  {t('settings.useOptimizedPreview', 'Use optimized video for preview')}
                </label>
                <div className="toggle-switch-container">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      id="use-optimized-preview"
                      checked={useOptimizedPreview}
                      onChange={(e) => setUseOptimizedPreview(e.target.checked)}
                      disabled={!optimizeVideos}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <p className="setting-description">
                {t('settings.useOptimizedPreviewDescription.simplified', 'Use the optimized video for preview instead of the original. This can improve performance on slower devices but will show lower quality video.')}
              </p>
            </div>
          </div>
        </div>

        {/* Display Settings Card */}
        <div className="settings-card display-card">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <DisplayIcon />
            </div>
            <h4>{t('settings.displaySettings', 'Display Settings')}</h4>
          </div>
          <div className="settings-card-content">
            <div className="compact-setting">
              <label htmlFor="time-format">
                {t('settings.timeFormat', 'Time Format')}
              </label>
              <p className="setting-description">
                {t('settings.timeFormatDescription', 'Choose how time is displayed in the timeline and lyrics.')}
              </p>
              <select
                id="time-format"
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value)}
                className="enhanced-select"
              >
                <option value="seconds">{t('settings.timeFormatSeconds', 'Seconds (e.g., 75.40s)')}</option>
                <option value="hms">{t('settings.timeFormatHMS', 'HH:MM:SS (e.g., 1:15.40)')}</option>
              </select>
            </div>

            <div className="compact-setting">
              <div className="setting-header">
                <label htmlFor="show-waveform">
                  {t('settings.showWaveform', 'Show Audio Waveform')}
                </label>
                <div className="toggle-switch-container">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      id="show-waveform"
                      checked={showWaveform}
                      onChange={(e) => setShowWaveform(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <p className="setting-description">
                {t('settings.showWaveformDescription', 'Display audio waveform visualization in the timeline. This helps identify silent parts and speech patterns.')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoProcessingTab;
