import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import CloseButton from './common/CloseButton';
import CustomDropdown from './common/CustomDropdown';
import '../styles/TranscriptionRulesEditor.css';
import { PROMPT_PRESETS, getUserPromptPresets } from '../services/geminiService';

const TranscriptionRulesEditor = ({ isOpen, onClose, initialRules, onSave, onCancel, onChangePrompt }) => {
  const { t } = useTranslation();
  const [rules, setRules] = useState(initialRules || {
    atmosphere: '',
    terminology: [],
    speakerIdentification: [],
    formattingConventions: [],
    spellingAndGrammar: [],
    relationships: [],
    additionalNotes: []
  });
  
  // Countdown state for autoflow
  const [countdown, setCountdown] = useState(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const countdownIntervalRef = useRef(null);
  const countdownTimeoutRef = useRef(null);

  // State for prompt presets
  const [currentPresetId, setCurrentPresetId] = useState('');
  const [userPromptPresets, setUserPromptPresets] = useState([]);

  // Track initial state for change detection
  const [initialState, setInitialState] = useState({
    rules: initialRules || {
      atmosphere: '',
      terminology: [],
      speakerIdentification: [],
      formattingConventions: [],
      spellingAndGrammar: [],
      relationships: [],
      additionalNotes: []
    },
    presetId: 'custom'
  });

  // Get all available presets (built-in + user)
  const allPresets = useMemo(() => [...PROMPT_PRESETS, ...userPromptPresets], [userPromptPresets]);

  // Function to check if there are changes
  const hasChanges = useMemo(() => {
    // Deep compare rules
    const rulesChanged = JSON.stringify(rules) !== JSON.stringify(initialState.rules);

    // Check if preset changed
    const presetChanged = currentPresetId !== initialState.presetId;

    return rulesChanged || presetChanged;
  }, [rules, currentPresetId, initialState]);

  // Initialize countdown if triggered by autoflow
  useEffect(() => {
    if (isOpen) {
      // Check if this was triggered by autoflow with countdown
      const shouldShowCountdown = sessionStorage.getItem('show_rules_editor_countdown') === 'true';
      
      if (shouldShowCountdown && !userInteracted) {
        const timeoutSetting = localStorage.getItem('video_analysis_timeout') || '10';
        
        if (timeoutSetting !== 'none') {
          if (timeoutSetting === 'infinite') {
            // For infinite countdown, just show a static message, no countdown
            setShowCountdown(true);
            setCountdown(-1); // Use -1 to indicate infinite
          } else {
            const seconds = parseInt(timeoutSetting, 10);
            if (!isNaN(seconds) && seconds > 0) {
              setShowCountdown(true);
              setCountdown(seconds);
            
              // Set up the countdown interval
              countdownIntervalRef.current = setInterval(() => {
                setCountdown(prev => {
                  if (prev <= 1) {
                    clearInterval(countdownIntervalRef.current);
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);
              
              // Set up the auto-save timeout
              countdownTimeoutRef.current = setTimeout(() => {
                if (!userInteracted) {
                  console.log('[TranscriptionRulesEditor] Countdown completed, auto-saving...');
                  handleSave();
                }
              }, seconds * 1000);
            }
          }
        }
      }
    }
    
    return () => {
      // Cleanup countdown when modal closes
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (countdownTimeoutRef.current) {
        clearTimeout(countdownTimeoutRef.current);
        countdownTimeoutRef.current = null;
      }
      // Clean up the flag
      if (!isOpen) {
        sessionStorage.removeItem('show_rules_editor_countdown');
      }
    };
  }, [isOpen, userInteracted]);
  
  // Stop countdown on user interaction
  const handleUserInteraction = () => {
    if (showCountdown && !userInteracted) {
      setUserInteracted(true);
      setShowCountdown(false);
      setCountdown(null);
      
      // Clear the intervals
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (countdownTimeoutRef.current) {
        clearTimeout(countdownTimeoutRef.current);
        countdownTimeoutRef.current = null;
      }
      
      console.log('[TranscriptionRulesEditor] User interaction detected, countdown cancelled');
    }
  };
  
  // Effect to determine the current preset and set initial state - run only once on mount
  useEffect(() => {
    // First check if there's a session-specific preset (from analysis)
    const sessionPresetId = sessionStorage.getItem('current_session_preset_id');
    let detectedPresetId = 'custom';

    if (sessionPresetId) {
      console.log('[TranscriptionRulesEditor] Using analysis-recommended preset:', sessionPresetId);
      detectedPresetId = sessionPresetId;
      setCurrentPresetId(sessionPresetId);
    } else {
      // If no session preset, try to determine from the stored prompt
      const storedPrompt = localStorage.getItem('transcription_prompt');

      // Get current presets (PROMPT_PRESETS + user presets)
      const currentPresets = [...PROMPT_PRESETS, ...getUserPromptPresets()];

      // Find a preset that matches the stored prompt
      const matchingPreset = currentPresets.find(preset => preset.prompt === storedPrompt);

      if (matchingPreset) {
        console.log('[TranscriptionRulesEditor] Using preset from stored prompt:', matchingPreset.id);
        detectedPresetId = matchingPreset.id;
        setCurrentPresetId(matchingPreset.id);
      } else {
        // If no matching preset, it's a custom prompt
        console.log('[TranscriptionRulesEditor] Using custom prompt');
        setCurrentPresetId('custom');
      }
    }

    // Set initial state for change tracking
    setInitialState({
      rules: initialRules || {
        atmosphere: '',
        terminology: [],
        speakerIdentification: [],
        formattingConventions: [],
        spellingAndGrammar: [],
        relationships: [],
        additionalNotes: []
      },
      presetId: detectedPresetId
    });

    // Load user presets
    setUserPromptPresets(getUserPromptPresets());
  }, []); // Empty dependency array - run only once on mount

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Handle atmosphere change
  const handleAtmosphereChange = (e) => {
    handleUserInteraction();
    setRules({
      ...rules,
      atmosphere: e.target.value
    });
  };

  // Handle array item change
  const handleArrayItemChange = (category, index, field, value) => {
    handleUserInteraction();
    const updatedArray = [...rules[category]];

    if (field) {
      // For objects in arrays (terminology, speakerIdentification)
      updatedArray[index] = {
        ...updatedArray[index],
        [field]: value
      };
    } else {
      // For simple string arrays
      updatedArray[index] = value;
    }

    setRules({
      ...rules,
      [category]: updatedArray
    });
  };

  // Add new item to array
  const addArrayItem = (category, template) => {
    handleUserInteraction();
    setRules({
      ...rules,
      [category]: [...(rules[category] || []), template]
    });
  };

  // Remove item from array
  const removeArrayItem = (category, index) => {
    handleUserInteraction();
    const updatedArray = [...rules[category]];
    updatedArray.splice(index, 1);

    setRules({
      ...rules,
      [category]: updatedArray
    });
  };

  // Handle save
  const handleSave = () => {
    onSave(rules);
    onClose('save');
  };

  // Handle cancel
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose('cancel');
  };

  // Handle changing the prompt preset
  const handleChangePrompt = (e) => {
    handleUserInteraction();
    const newPresetId = e.target.value;
    setCurrentPresetId(newPresetId);

    if (newPresetId === 'custom') {
      // For custom preset, do nothing as we're keeping the current prompt
      return;
    }

    // Find the preset
    const preset = allPresets.find(p => p.id === newPresetId);
    if (preset && onChangePrompt) {
      // If it's a session preset, update session storage
      if (sessionStorage.getItem('current_session_preset_id')) {
        sessionStorage.setItem('current_session_preset_id', newPresetId);
        sessionStorage.setItem('current_session_prompt', preset.prompt);
      } else {
        // Otherwise update localStorage
        localStorage.setItem('transcription_prompt', preset.prompt);
      }

      // Call the callback to update the prompt in the parent component
      onChangePrompt(preset);
    }
  };

  // Get preset title based on ID
  const getPresetTitle = (presetId) => {
    if (presetId === 'custom') {
      return t('settings.promptFromSettings', 'Prompt from settings');
    }

    const preset = allPresets.find(p => p.id === presetId);
    if (!preset) return presetId;

    switch (preset.id) {
      case 'general':
        return t('settings.presetGeneralPurpose', 'General purpose');
      case 'extract-text':
        return t('settings.presetExtractText', 'Extract text');
      case 'focus-lyrics':
        return t('settings.presetFocusLyrics', 'Focus on Lyrics');
      case 'describe-video':
        return t('settings.presetDescribeVideo', 'Describe video');
      case 'translate-directly':
        return t('settings.presetTranslateDirectly', 'Translate directly');
      case 'chaptering':
        return t('settings.presetChaptering', 'Chaptering');
      case 'diarize-speakers':
        return t('settings.presetIdentifySpeakers', 'Identify Speakers');
      default:
        return preset.title || presetId;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="rules-editor-overlay" onClick={handleUserInteraction}>
      <div className={`rules-editor-modal ${showCountdown ? 'with-countdown' : ''}`} onClick={(e) => {
        e.stopPropagation();
        handleUserInteraction();
      }}>
        {showCountdown && (
          <div className="countdown-banner" onClick={handleUserInteraction}>
            <div className="countdown-content">
              {countdown === -1 ? (
                <>
                  <span className="countdown-text">
                    {t('rulesEditor.waitingForAction', 'Waiting for your action')}
                  </span>
                  <span className="countdown-hint">
                    {t('rulesEditor.clickToEdit', '(click to start editing)')}
                  </span>
                </>
              ) : (
                <>
                  <span className="countdown-text">
                    {t('rulesEditor.autoSaveCountdown', 'Auto-saving in')}
                  </span>
                  <span className="countdown-number">{countdown}</span>
                  <span className="countdown-text">
                    {t('rulesEditor.seconds', 'seconds')}
                  </span>
                  <span className="countdown-hint">
                    {t('rulesEditor.clickToCancel', '(click anywhere to cancel)')}
                  </span>
                </>
              )}
            </div>
            {countdown !== -1 && (
              <div className="countdown-progress">
                <div 
                  className="countdown-progress-bar" 
                  style={{ 
                    width: `${((parseInt(localStorage.getItem('video_analysis_timeout') || '10', 10) - countdown) / parseInt(localStorage.getItem('video_analysis_timeout') || '10', 10)) * 100}%` 
                  }}
                />
              </div>
            )}
          </div>
        )}
        <div className="modal-header">
          <h2>{t('rulesEditor.title', 'Edit Transcription Rules')}</h2>
          <CloseButton onClick={handleCancel} variant="modal" size="medium" />
        </div>

        <div className="prompt-preset-selector">
          <div className="prompt-preset-label">
            {t('rulesEditor.currentPrompt', 'Current Prompt Preset')}:
          </div>
          <div className="prompt-preset-dropdown">
            <CustomDropdown
              value={currentPresetId}
              onChange={(value) => handleChangePrompt({ target: { value } })}
              onClick={handleUserInteraction}
              options={[
                // Prompt from settings option
                { value: 'custom', label: t('settings.promptFromSettings', 'Prompt from settings') },

                // Built-in presets with prefix
                ...PROMPT_PRESETS.map(preset => ({
                  value: preset.id,
                  label: `📋 ${getPresetTitle(preset.id)}`
                })),

                // User presets with prefix
                ...userPromptPresets.map(preset => ({
                  value: preset.id,
                  label: `👤 ${preset.title}`
                }))
              ]}
              placeholder={t('settings.selectPreset', 'Select Preset')}
            />
          </div>
        </div>

        <div className="modal-content">
          <div className="rules-editor-section">
            <h3>{t('videoAnalysis.atmosphere', 'Atmosphere')}</h3>
            <textarea
              value={rules.atmosphere || ''}
              onChange={handleAtmosphereChange}
              onClick={handleUserInteraction}
              onFocus={handleUserInteraction}
              placeholder={t('rulesEditor.atmospherePlaceholder', 'Description of the setting or context...')}
              rows={3}
            />
          </div>

          <div className="rules-editor-section">
            <h3>{t('videoAnalysis.terminology', 'Terminology & Proper Nouns')}</h3>
            <p className="section-description">{t('rulesEditor.terminologyDescription', 'Add specialized terms, proper nouns, and their definitions')}</p>

            {(rules.terminology || []).map((term, index) => (
              <div key={index} className="array-item-row">
                <div className="term-inputs">
                  <input
                    value={term.term || ''}
                    onChange={(e) => handleArrayItemChange('terminology', index, 'term', e.target.value)}
                    onClick={handleUserInteraction}
                    onFocus={handleUserInteraction}
                    placeholder={t('rulesEditor.termPlaceholder', 'Term')}
                  />
                  <input
                    value={term.definition || ''}
                    onChange={(e) => handleArrayItemChange('terminology', index, 'definition', e.target.value)}
                    onClick={handleUserInteraction}
                    onFocus={handleUserInteraction}
                    placeholder={t('rulesEditor.definitionPlaceholder', 'Definition')}
                    className="definition-input"
                  />
                </div>
                <button
                  className="remove-item-button"
                  onClick={() => {
                    handleUserInteraction();
                    removeArrayItem('terminology', index);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
                    <path d="M480-392 300-212q-18 18-44 18t-44-18q-18-18-18-44t18-44l180-180-180-180q-18-18-18-44t18-44q18-18 44-18t44 18l180 180 180-180q18-18 44-18t44 18q18 18 18 44t-18 44L568-480l180 180q18 18 18 44t-18 44q-18 18-44 18t-44-18L480-392Z"/>
                  </svg>
                </button>
              </div>
            ))}

            <button
              className="add-item-button"
              onClick={() => {
                handleUserInteraction();
                addArrayItem('terminology', { term: '', definition: '' });
              }}
            >
              {t('rulesEditor.addTerm', '+ Add Term')}
            </button>
          </div>

          <div className="rules-editor-section">
            <h3>{t('videoAnalysis.speakerIdentification', 'Speaker Identification')}</h3>
            <p className="section-description">{t('rulesEditor.speakersDescription', 'Add information about different speakers')}</p>

            {(rules.speakerIdentification || []).map((speaker, index) => (
              <div key={index} className="array-item-row">
                <div className="term-inputs">
                  <input
                    value={speaker.speakerId || ''}
                    onChange={(e) => handleArrayItemChange('speakerIdentification', index, 'speakerId', e.target.value)}
                    placeholder={t('rulesEditor.speakerIdPlaceholder', 'Speaker ID (e.g., "Speaker 1", "John")')}
                  />
                  <input
                    value={speaker.description || ''}
                    onChange={(e) => handleArrayItemChange('speakerIdentification', index, 'description', e.target.value)}
                    placeholder={t('rulesEditor.speakerDescPlaceholder', 'Description')}
                    className="definition-input"
                  />
                </div>
                <button
                  className="remove-item-button"
                  onClick={() => removeArrayItem('speakerIdentification', index)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
                    <path d="M480-392 300-212q-18 18-44 18t-44-18q-18-18-18-44t18-44l180-180-180-180q-18-18-18-44t18-44q18-18 44-18t44 18l180 180 180-180q18-18 44-18t44 18q18 18 18 44t-18 44L568-480l180 180q18 18 18 44t-18 44q-18 18-44 18t-44-18L480-392Z"/>
                  </svg>
                </button>
              </div>
            ))}

            <button
              className="add-item-button"
              onClick={() => addArrayItem('speakerIdentification', { speakerId: '', description: '' })}
            >
              {t('rulesEditor.addSpeaker', '+ Add Speaker')}
            </button>
          </div>

          <div className="rules-editor-section">
            <h3>{t('videoAnalysis.formattingConventions', 'Formatting & Style Conventions')}</h3>
            <p className="section-description">{t('rulesEditor.formattingDescription', 'Add formatting and style rules')}</p>

            {(rules.formattingConventions || []).map((convention, index) => (
              <div key={index} className="array-item-row">
                <input
                  value={convention || ''}
                  onChange={(e) => handleArrayItemChange('formattingConventions', index, null, e.target.value)}
                  placeholder={t('rulesEditor.conventionPlaceholder', 'Formatting rule...')}
                  className="full-width-input"
                />
                <button
                  className="remove-item-button"
                  onClick={() => removeArrayItem('formattingConventions', index)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
                    <path d="M480-392 300-212q-18 18-44 18t-44-18q-18-18-18-44t18-44l180-180-180-180q-18-18-18-44t18-44q18-18 44-18t44 18l180 180 180-180q18-18 44-18t44 18q18 18 18 44t-18 44L568-480l180 180q18 18 18 44t-18 44q-18 18-44 18t-44-18L480-392Z"/>
                  </svg>
                </button>
              </div>
            ))}

            <button
              className="add-item-button"
              onClick={() => addArrayItem('formattingConventions', '')}
            >
              {t('rulesEditor.addFormatting', '+ Add Formatting Rule')}
            </button>
          </div>

          <div className="rules-editor-section">
            <h3>{t('videoAnalysis.spellingAndGrammar', 'Spelling, Grammar & Punctuation')}</h3>
            <p className="section-description">{t('rulesEditor.spellingDescription', 'Add spelling, grammar, and punctuation rules')}</p>

            {(rules.spellingAndGrammar || []).map((rule, index) => (
              <div key={index} className="array-item-row">
                <input
                  value={rule || ''}
                  onChange={(e) => handleArrayItemChange('spellingAndGrammar', index, null, e.target.value)}
                  placeholder={t('rulesEditor.spellingRulePlaceholder', 'Spelling or grammar rule...')}
                  className="full-width-input"
                />
                <button
                  className="remove-item-button"
                  onClick={() => removeArrayItem('spellingAndGrammar', index)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
                    <path d="M480-392 300-212q-18 18-44 18t-44-18q-18-18-18-44t18-44l180-180-180-180q-18-18-18-44t18-44q18-18 44-18t44 18l180 180 180-180q18-18 44-18t44 18q18 18 18 44t-18 44L568-480l180 180q18 18 18 44t-18 44q-18 18-44 18t-44-18L480-392Z"/>
                  </svg>
                </button>
              </div>
            ))}

            <button
              className="add-item-button"
              onClick={() => addArrayItem('spellingAndGrammar', '')}
            >
              {t('rulesEditor.addSpellingRule', '+ Add Spelling/Grammar Rule')}
            </button>
          </div>

          <div className="rules-editor-section">
            <h3>{t('videoAnalysis.relationships', 'Relationships & Social Hierarchy')}</h3>
            <p className="section-description">{t('rulesEditor.relationshipsDescription', 'Add information about relationships between people')}</p>

            {(rules.relationships || []).map((relationship, index) => (
              <div key={index} className="array-item-row">
                <input
                  value={relationship || ''}
                  onChange={(e) => handleArrayItemChange('relationships', index, null, e.target.value)}
                  placeholder={t('rulesEditor.relationshipPlaceholder', 'Relationship information...')}
                  className="full-width-input"
                />
                <button
                  className="remove-item-button"
                  onClick={() => removeArrayItem('relationships', index)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
                    <path d="M480-392 300-212q-18 18-44 18t-44-18q-18-18-18-44t18-44l180-180-180-180q-18-18-18-44t18-44q18-18 44-18t44 18l180 180 180-180q18-18 44-18t44 18q18 18 18 44t-18 44L568-480l180 180q18 18 18 44t-18 44q-18 18-44 18t-44-18L480-392Z"/>
                  </svg>
                </button>
              </div>
            ))}

            <button
              className="add-item-button"
              onClick={() => addArrayItem('relationships', '')}
            >
              {t('rulesEditor.addRelationship', '+ Add Relationship')}
            </button>
          </div>

          <div className="rules-editor-section">
            <h3>{t('videoAnalysis.additionalNotes', 'Additional Notes')}</h3>
            <p className="section-description">{t('rulesEditor.notesDescription', 'Add any other notes for consistent transcription')}</p>

            {(rules.additionalNotes || []).map((note, index) => (
              <div key={index} className="array-item-row">
                <input
                  value={note || ''}
                  onChange={(e) => handleArrayItemChange('additionalNotes', index, null, e.target.value)}
                  placeholder={t('rulesEditor.notePlaceholder', 'Additional note...')}
                  className="full-width-input"
                />
                <button
                  className="remove-item-button"
                  onClick={() => removeArrayItem('additionalNotes', index)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
                    <path d="M480-392 300-212q-18 18-44 18t-44-18q-18-18-18-44t18-44l180-180-180-180q-18-18-18-44t18-44q18-18 44-18t44 18l180 180 180-180q18-18 44-18t44 18q18 18 18 44t-18 44L568-480l180 180q18 18 18 44t-18 44q-18 18-44 18t-44-18L480-392Z"/>
                  </svg>
                </button>
              </div>
            ))}

            <button
              className="add-item-button"
              onClick={() => addArrayItem('additionalNotes', '')}
            >
              {t('rulesEditor.addNote', '+ Add Note')}
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={handleCancel}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            className={`save-button ${!hasChanges && !showCountdown ? 'disabled' : ''} ${showCountdown ? 'autoflow-active' : ''}`}
            onClick={handleSave}
            disabled={!hasChanges && !showCountdown}
          >
            {showCountdown 
              ? t('rulesEditor.saveContinue', 'Save & Continue')
              : t('common.save', 'Save')
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranscriptionRulesEditor;
