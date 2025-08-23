import React from 'react';
import { useTranslation } from 'react-i18next';
import StandardSlider from '../../common/StandardSlider';
import MaterialSwitch from '../../common/MaterialSwitch';
import { DisplayIcon, VideoAnalysisIcon } from '../icons/TabIcons';
import { FiCpu } from 'react-icons/fi';
import CustomGeminiModelsCard from '../components/CustomGeminiModelsCard';
import '../../../styles/common/material-switch.css';
import '../../../styles/settings/customGeminiModels.css';

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
  setUseVideoAnalysis,
  videoAnalysisModel,
  setVideoAnalysisModel,
  optimizeVideos,
  setOptimizeVideos,
  optimizedResolution,
  setOptimizedResolution,
  useOptimizedPreview,
  setUseOptimizedPreview,
  thinkingBudgets,
  setThinkingBudgets,
  useCookiesForDownload,
  setUseCookiesForDownload,
  customGeminiModels,
  setCustomGeminiModels
}) => {
  const { t } = useTranslation();

  // Helper function to get analysis models (subset of all models)
  const getAnalysisModels = () => {
    const builtInAnalysisModels = [
      { id: 'gemini-2.5-flash', name: t('settings.modelFlash25', 'Gemini 2.5 Flash (Best)') },
      { id: 'gemini-2.5-flash-lite', name: t('settings.modelFlash25LiteAnalysis', 'Gemini 2.5 Flash Lite (Good + Fast)') },
      { id: 'gemini-2.0-flash', name: t('settings.modelFlash', 'Gemini 2.0 Flash (More Detailed)') }
    ];

    const customModels = customGeminiModels.map(model => ({
      id: model.id,
      name: `${model.name} (Custom)`,
      isCustom: true
    }));

    return [...builtInAnalysisModels, ...customModels];
  };

  // Helper function to get the dropdown mode for a thinking budget value
  const getThinkingMode = (budget) => {
    if (budget === -1) return 'dynamic';
    if (budget === 0) return 'disabled';
    return 'custom';
  };

  // Helper function to get the slider value for custom mode (map token count to 0-100)
  const getSliderValue = (budget, modelId) => {
    if (modelId === 'gemini-2.5-pro') {
      // Range: 128-32768 tokens
      return Math.round(((budget - 128) / (32768 - 128)) * 100);
    } else if (modelId === 'gemini-2.5-flash') {
      // Range: 1-24576 tokens for Flash (start from 1 to avoid conflict with disabled)
      return Math.round(((budget - 1) / (24576 - 1)) * 100);
    } else {
      // Range: 512-24576 tokens for Flash Lite
      return Math.round(((budget - 512) / (24576 - 512)) * 100);
    }
  };

  // Helper function to convert slider value back to token count
  const getTokensFromSlider = (sliderValue, modelId) => {
    if (modelId === 'gemini-2.5-pro') {
      // Range: 128-32768 tokens
      return Math.round(128 + (sliderValue / 100) * (32768 - 128));
    } else if (modelId === 'gemini-2.5-flash') {
      // Range: 1-24576 tokens for Flash (start from 1 to avoid conflict with disabled)
      return Math.round(1 + (sliderValue / 100) * (24576 - 1));
    } else {
      // Range: 512-24576 tokens for Flash Lite
      return Math.round(512 + (sliderValue / 100) * (24576 - 512));
    }
  };

  // Handle dropdown mode change
  const handleModeChange = (modelId, mode) => {
    let newBudget;
    if (mode === 'dynamic') {
      newBudget = -1;
    } else if (mode === 'disabled') {
      newBudget = 0;
    } else if (mode === 'custom') {
      // Set to a reasonable default for custom mode
      if (modelId === 'gemini-2.5-pro') {
        newBudget = 1024;
      } else if (modelId === 'gemini-2.5-flash') {
        newBudget = 1024; // Flash can start from 0, but 1024 is a good default
      } else {
        newBudget = 512; // Flash Lite minimum is 512
      }
    }

    setThinkingBudgets(prev => ({
      ...prev,
      [modelId]: newBudget
    }));
  };

  // Handle slider change for custom mode
  const handleSliderChange = (modelId, sliderValue) => {
    const tokens = getTokensFromSlider(sliderValue, modelId);
    setThinkingBudgets(prev => ({
      ...prev,
      [modelId]: tokens
    }));
  };

  return (
    <div className="settings-section video-processing-section">

      {/* Grid layout for settings cards */}
      <div className="video-processing-grid">

        {/* Display & Download Settings Card (Merged) */}
        <div className="settings-card display-download-card">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <DisplayIcon />
            </div>
            <h4>{t('settings.displayDownloadSettings', 'Display & Download Settings')}</h4>
          </div>
          <div className="settings-card-content">
            {/* Time Format Setting */}
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

            {/* Audio Waveform Setting */}
            <div className="compact-setting">
              <div className="setting-header">
                <label htmlFor="show-waveform">
                  {t('settings.showWaveform', 'Show Audio Waveform')}
                </label>
                <div className="material-switch-container">
                  <MaterialSwitch
                    id="show-waveform"
                    checked={showWaveform}
                    onChange={(e) => setShowWaveform(e.target.checked)}
                    ariaLabel={t('settings.showWaveform', 'Show Audio Waveform')}
                    icons={true}
                  />
                </div>
              </div>
              <p className="setting-description">
                {t('settings.showWaveformDescription', 'Display audio waveform visualization in the timeline. This helps identify silent parts and speech patterns.')}
              </p>
            </div>

            {/* Download Cookies Setting */}
            <div className="compact-setting">
              <div className="setting-header">
                <label htmlFor="use-cookies-download">
                  {t('settings.useCookiesForDownload', 'Use browser cookies for video downloads')}
                </label>
                <div className="material-switch-container">
                  <MaterialSwitch
                    id="use-cookies-download"
                    checked={useCookiesForDownload}
                    onChange={(e) => setUseCookiesForDownload(e.target.checked)}
                    ariaLabel={t('settings.useCookiesForDownload', 'Use browser cookies for video downloads')}
                    icons={true}
                  />
                </div>
              </div>
              <p className="setting-description">
                {t('settings.useCookiesForDownloadDescription', 'Enable browser cookie authentication to access higher quality videos and bypass login restrictions. Disabling this will make downloads faster but may limit available video qualities and cause failures on restricted content.')}
              </p>
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
            <div className="compact-setting">
              <p className="setting-description">
                {t('settings.useVideoAnalysisDescription', 'Settings for the "Add analysis" button, which analyze the entire video with Gemini to identify the best prompt pattern and generate transcription rules.')}
              </p>
            </div>

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
              >
                {getAnalysisModels().map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>


          </div>
        </div>

        {/* Thinking Budget Card */}
        <div className="settings-card thinking-card">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <FiCpu />
            </div>
            <h4>{t('settings.thinkingBudgetSection', 'AI Thinking Budget')}</h4>
          </div>
          <div className="settings-card-content">
            <p className="setting-description">
              {t('settings.thinkingBudgetDescription', 'Configure how much thinking each AI model should use. Higher budgets allow more detailed reasoning but increase processing time and cost.')}
            </p>

            {/* Gemini 2.5 Pro */}
            <div className="compact-setting">
              <label htmlFor="thinking-mode-25-pro">
                {t('settings.thinkingBudget25Pro', 'Gemini 2.5 Pro Thinking Budget')}
              </label>
              <p className="setting-description">
                {t('settings.thinkingBudget25ProDesc', 'Cannot disable thinking. Choose dynamic or set custom token budget.')}
              </p>
              <select
                id="thinking-mode-25-pro"
                value={getThinkingMode(thinkingBudgets['gemini-2.5-pro'] || -1)}
                onChange={(e) => handleModeChange('gemini-2.5-pro', e.target.value)}
                className="enhanced-select"
              >
                <option value="dynamic">{t('settings.thinkingDynamic', 'Dynamic (Auto)')}</option>
                <option value="custom">{t('settings.thinkingCustom', 'Custom')}</option>
              </select>

              {getThinkingMode(thinkingBudgets['gemini-2.5-pro'] || -1) === 'custom' && (
                <div className="thinking-slider-container">
                  <div className="slider-with-value">
                    <StandardSlider
                      value={getSliderValue(thinkingBudgets['gemini-2.5-pro'], 'gemini-2.5-pro')}
                      onChange={(value) => handleSliderChange('gemini-2.5-pro', parseInt(value))}
                      min={0}
                      max={100}
                      step={1}
                      orientation="Horizontal"
                      size="XSmall"
                      state="Enabled"
                      showValueIndicator={false} // Using custom value display
                      showIcon={false}
                      showStops={false}
                      className="thinking-budget-slider"
                      id="thinking-budget-pro"
                      ariaLabel={t('settings.thinkingBudget', 'Thinking Budget')}
                    />
                    <div className="slider-value-display">
                      {thinkingBudgets['gemini-2.5-pro']} {t('settings.tokens', 'tokens')}
                    </div>
                  </div>
                  <div className="slider-range-info">
                    {t('settings.thinkingRange', 'Range')}: 128 - 32,768 {t('settings.tokens', 'tokens')}
                  </div>
                </div>
              )}
            </div>

            {/* Gemini 2.5 Flash */}
            <div className="compact-setting">
              <label htmlFor="thinking-mode-25-flash">
                {t('settings.thinkingBudget25Flash', 'Gemini 2.5 Flash Thinking Budget')}
              </label>
              <p className="setting-description">
                {t('settings.thinkingBudget25FlashDesc', 'Can be disabled for fastest response, dynamic for auto, or custom token budget.')}
              </p>
              <select
                id="thinking-mode-25-flash"
                value={getThinkingMode(thinkingBudgets['gemini-2.5-flash'] || -1)}
                onChange={(e) => handleModeChange('gemini-2.5-flash', e.target.value)}
                className="enhanced-select"
              >
                <option value="disabled">{t('settings.thinkingDisabled', 'Disabled')}</option>
                <option value="dynamic">{t('settings.thinkingDynamic', 'Dynamic (Auto)')}</option>
                <option value="custom">{t('settings.thinkingCustom', 'Custom')}</option>
              </select>

              {getThinkingMode(thinkingBudgets['gemini-2.5-flash'] || -1) === 'custom' && (
                <div className="thinking-slider-container">
                  <div className="slider-with-value">
                    <StandardSlider
                      value={getSliderValue(thinkingBudgets['gemini-2.5-flash'], 'gemini-2.5-flash')}
                      onChange={(value) => handleSliderChange('gemini-2.5-flash', parseInt(value))}
                      min={0}
                      max={100}
                      step={1}
                      orientation="Horizontal"
                      size="XSmall"
                      state="Enabled"
                      showValueIndicator={false} // Using custom value display
                      showIcon={false}
                      showStops={false}
                      className="thinking-budget-slider"
                      id="thinking-budget-flash"
                      ariaLabel={t('settings.thinkingBudget', 'Thinking Budget')}
                    />
                    <div className="slider-value-display">
                      {thinkingBudgets['gemini-2.5-flash']} {t('settings.tokens', 'tokens')}
                    </div>
                  </div>
                  <div className="slider-range-info">
                    {t('settings.thinkingRange', 'Range')}: 1 - 24,576 {t('settings.tokens', 'tokens')}
                  </div>
                </div>
              )}
            </div>

            {/* Gemini 2.5 Flash Lite */}
            <div className="compact-setting">
              <label htmlFor="thinking-mode-25-flash-lite">
                {t('settings.thinkingBudget25FlashLite', 'Gemini 2.5 Flash Lite Thinking Budget')}
              </label>
              <p className="setting-description">
                {t('settings.thinkingBudget25FlashLiteDesc', 'Disabled by default for fastest response. Choose dynamic or custom token budget.')}
              </p>
              <select
                id="thinking-mode-25-flash-lite"
                value={getThinkingMode(thinkingBudgets['gemini-2.5-flash-lite'] || 0)}
                onChange={(e) => handleModeChange('gemini-2.5-flash-lite', e.target.value)}
                className="enhanced-select"
              >
                <option value="disabled">{t('settings.thinkingDisabled', 'Disabled')} ({t('settings.default', 'Default')})</option>
                <option value="dynamic">{t('settings.thinkingDynamic', 'Dynamic (Auto)')}</option>
                <option value="custom">{t('settings.thinkingCustom', 'Custom')}</option>
              </select>

              {getThinkingMode(thinkingBudgets['gemini-2.5-flash-lite'] || 0) === 'custom' && (
                <div className="thinking-slider-container">
                  <div className="slider-with-value">
                    <StandardSlider
                      value={getSliderValue(thinkingBudgets['gemini-2.5-flash-lite'], 'gemini-2.5-flash-lite')}
                      onChange={(value) => handleSliderChange('gemini-2.5-flash-lite', parseInt(value))}
                      min={0}
                      max={100}
                      step={1}
                      orientation="Horizontal"
                      size="XSmall"
                      state="Enabled"
                      showValueIndicator={false} // Using custom value display
                      showIcon={false}
                      showStops={false}
                      className="thinking-budget-slider"
                      id="thinking-budget-lite"
                      ariaLabel={t('settings.thinkingBudget', 'Thinking Budget')}
                    />
                    <div className="slider-value-display">
                      {thinkingBudgets['gemini-2.5-flash-lite']} {t('settings.tokens', 'tokens')}
                    </div>
                  </div>
                  <div className="slider-range-info">
                    {t('settings.thinkingRange', 'Range')}: 512 - 24,576 {t('settings.tokens', 'tokens')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Custom Gemini Models Card */}
        <CustomGeminiModelsCard
          customGeminiModels={customGeminiModels}
          setCustomGeminiModels={setCustomGeminiModels}
        />
      </div>
    </div>
  );
};

export default VideoProcessingTab;
