import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllKeys, addKey, removeKey, getActiveKeyIndex, setActiveKeyIndex } from '../../../services/gemini/keyManager';
import { animateToggle, toggleKeyVisibility } from '../utils/keyVisibilityAnimation';

// Hook owning the multiple Gemini API key state + handlers.
export const useGeminiKeys = ({ setGeminiApiKey, setApiKeysSet }) => {
  const [geminiApiKeys, setGeminiApiKeys] = useState([]);
  const [newGeminiKey, setNewGeminiKey] = useState('');
  const [showNewGeminiKey, setShowNewGeminiKey] = useState(false);
  const [activeKeyIndex, setActiveKeyIndexState] = useState(0);
  const [visibleKeyIndices, setVisibleKeyIndices] = useState({});

  // Load all Gemini API keys on mount
  useEffect(() => {
    const keys = getAllKeys();
    setGeminiApiKeys(keys);
    setActiveKeyIndexState(getActiveKeyIndex());
  }, []);

  // Update the active key when it changes
  const handleSetActiveKey = (index) => {
    setActiveKeyIndex(index);
    setActiveKeyIndexState(index);
    // Update the single key for backward compatibility
    setGeminiApiKey(geminiApiKeys[index]);
  };

  // Add a new Gemini API key
  const handleAddGeminiKey = () => {
    if (newGeminiKey && newGeminiKey.trim()) {
      if (addKey(newGeminiKey)) {
        const updatedKeys = getAllKeys();
        setGeminiApiKeys(updatedKeys);
        setNewGeminiKey('');
        setShowNewGeminiKey(false);

        // Update API keys set status
        setApiKeysSet(prevState => ({
          ...prevState,
          gemini: true
        }));
      }
    }
  };

  // Remove a Gemini API key
  const handleRemoveGeminiKey = (key) => {
    if (removeKey(key)) {
      const updatedKeys = getAllKeys();
      setGeminiApiKeys(updatedKeys);

      // Update API keys set status
      setApiKeysSet(prevState => ({
        ...prevState,
        gemini: updatedKeys.length > 0
      }));
    }
  };

  return {
    geminiApiKeys,
    newGeminiKey,
    setNewGeminiKey,
    showNewGeminiKey,
    setShowNewGeminiKey,
    activeKeyIndex,
    visibleKeyIndices,
    setVisibleKeyIndices,
    handleSetActiveKey,
    handleAddGeminiKey,
    handleRemoveGeminiKey,
  };
};

// Presentational component rendering the multi-key management UI.
const GeminiKeysManager = ({
  geminiApiKeys,
  newGeminiKey,
  setNewGeminiKey,
  showNewGeminiKey,
  setShowNewGeminiKey,
  activeKeyIndex,
  visibleKeyIndices,
  setVisibleKeyIndices,
  handleSetActiveKey,
  handleAddGeminiKey,
  handleRemoveGeminiKey,
}) => {
  const { t } = useTranslation();
  const newGeminiKeyRef = useRef(null);

  useEffect(() => {
    if (showNewGeminiKey && newGeminiKeyRef.current) {
      newGeminiKeyRef.current.focus();
    }
  }, [showNewGeminiKey]);

  return (
    <div className="gemini-keys-container">
      {geminiApiKeys.length > 0 ? (
        <div className="gemini-keys-list">
          {geminiApiKeys.map((key, index) => (
            <div
              key={`gemini-key-${index}`}
              id={`gemini-key-${index}`}
              className={`gemini-key-item ${index === activeKeyIndex ? 'active' : ''} ${geminiApiKeys.length === 1 ? 'single-key' : ''}`}
            >
              <div className="gemini-key-content">
                {visibleKeyIndices[index] ? (
                  <>
                    <div className="gemini-key-display">
                      <div className="gemini-key-text">
                        <div className="gemini-key-visible">
                          {key}
                        </div>
                      </div>
                    </div>
                    <div className="gemini-key-actions expanded">
                      <button
                        type="button"
                        className="gemini-key-button"
                        onClick={() => toggleKeyVisibility(index, setVisibleKeyIndices)}
                        title={t('settings.hideKey', 'Hide key')}
                      >
                        {t('settings.hide', 'Hide')}
                      </button>
                      <div className="gemini-key-actions-right">
                        <button
                          type="button"
                          className={`gemini-key-button ${index === activeKeyIndex ? 'active' : ''}`}
                          onClick={() => handleSetActiveKey(index)}
                          disabled={index === activeKeyIndex}
                          title={t('settings.setAsActive', 'Set as active key')}
                        >
                          {index === activeKeyIndex ?
                            t('settings.activeKey', 'Active') :
                            t('settings.setActive', 'Set Active')}
                        </button>
                        <button
                          type="button"
                          className="remove-key"
                          onClick={() => handleRemoveGeminiKey(key)}
                          title={t('settings.removeKey', 'Remove key')}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>close</span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="gemini-key-row">
                    <div
                      className="gemini-key-text gemini-key-masked"
                      title={key}
                    >
                      {key ? `${key.substring(0, 4)}••••••${key.substring(key.length - 4)}` : ''}
                    </div>
                    <div className="gemini-key-actions">
                      <button
                        type="button"
                        className="gemini-key-button"
                        onClick={() => toggleKeyVisibility(index, setVisibleKeyIndices)}
                        title={t('settings.showKey', 'Show key')}
                      >
                        {t('settings.show', 'Show')}
                      </button>
                      <button
                        type="button"
                        className={`gemini-key-button ${index === activeKeyIndex ? 'active' : ''}`}
                        onClick={() => handleSetActiveKey(index)}
                        disabled={index === activeKeyIndex}
                        title={t('settings.setAsActive', 'Set as active key')}
                      >
                        {index === activeKeyIndex ?
                          t('settings.activeKey', 'Active') :
                          t('settings.setActive', 'Set Active')}
                      </button>
                      <button
                        type="button"
                        className="remove-key"
                        onClick={() => handleRemoveGeminiKey(key)}
                        title={t('settings.removeKey', 'Remove key')}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>close</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="no-keys-message">
          {t('settings.noGeminiKeys', 'No Gemini API keys added yet. Add your first key below.')}
        </div>
      )}

      {/* Add new key input */}
      <div className="add-new-key-container">
        <div className="add-key-input-row">
          <div className="custom-api-key-input">
            <div className="custom-input-field">
              <input
                type="text"
                id="new-gemini-key-input"
                className={`api-key-input-field ${!showNewGeminiKey ? 'masked-input' : ''}`}
                value={newGeminiKey}
                onChange={(e) => setNewGeminiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddGeminiKey();
                  }
                }}
                placeholder={t('settings.addGeminiKeyPlaceholder', 'Enter a new Gemini API key')}
                ref={newGeminiKeyRef}
                autoComplete="new-password"
                data-lpignore="true"
                data-form-type="other"
                spellCheck="false"
              />
            </div>
            <button
              type="button"
              className="toggle-visibility"
              onClick={() => animateToggle('new-gemini-key-input', showNewGeminiKey, setShowNewGeminiKey)}
              aria-label={showNewGeminiKey ? t('settings.hide') : t('settings.show')}
            >
              {showNewGeminiKey ? t('settings.hide') : t('settings.show')}
            </button>
          </div>
          <button
            type="button"
            className="add-key-button"
            onClick={handleAddGeminiKey}
            disabled={!newGeminiKey}
          >
            {t('settings.addKey', 'Add Key')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeminiKeysManager;
