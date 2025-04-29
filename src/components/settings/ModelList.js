import React from 'react';
import { useTranslation } from 'react-i18next';
import DownloadIcon from '@mui/icons-material/Download';
import CancelIcon from '@mui/icons-material/Cancel';
import AddIcon from '@mui/icons-material/Add';
import { addModelFromHuggingFace, cancelModelDownload } from '../../services/modelService';
import { invalidateModelsCache } from '../../services/modelAvailabilityService';
import '../../styles/settings/modelManagement.css';

// List of available models from F5-TTS SHARED.md
const AVAILABLE_MODELS = [
  {
    "id": "f5tts-ar-ibrahim",
    "name": "F5-TTS Arabic (MSA)",
    "languages": ["ar"],
    "author": "IbrahimSalah",
    "modelUrl": "hf://IbrahimSalah/F5-TTS-Arabic/model_750000.safetensors",
    "vocabUrl": "hf://IbrahimSalah/F5-TTS-Arabic/vocab.txt",
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
  {
    "id": "f5tts-de-marduk",
    "name": "F5-TTS German (marduk-ra)",
    "languages": ["de"],
    "author": "marduk-ra",
    "modelUrl": "hf://marduk-ra/F5-TTS-German/model.safetensors", // Placeholder filename, needs verification
    "vocabUrl": "hf://marduk-ra/F5-TTS-German/vocab.txt", // Placeholder filename, needs verification
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
  {
    "id": "f5tts-v1-base", // Primarily zh, en
    "name": "F5-TTS v1 Base",
    "languages": ["zh", "en"],
    "author": "F5-TTS",
    "modelUrl": "hf://SWivid/F5-TTS/F5TTS_v1_Base/model_1250000.safetensors",
    "vocabUrl": "hf://SWivid/F5-TTS/F5TTS_v1_Base/vocab.txt",
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "conv_layers": 4
    }
  },
  {
    "id": "f5tts-base", // Primarily zh, en
    "name": "F5-TTS Base",
    "languages": ["zh", "en"],
    "author": "F5-TTS",
    "modelUrl": "hf://SWivid/F5-TTS/F5TTS_Base/model_1200000.safetensors",
    "vocabUrl": "hf://SWivid/F5-TTS/F5TTS_Base/vocab.txt",
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
    {
    "id": "f5tts-base-es",
    "name": "F5-TTS Base Spanish",
    "languages": ["es"],
    "author": "jpgallegoar",
    "modelUrl": "hf://jpgallegoar/F5-Spanish/model_1200000.safetensors",
    "vocabUrl": "hf://jpgallegoar/F5-Spanish/vocab.txt",
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
  {
    "id": "f5tts-base-fi",
    "name": "F5-TTS Base Finnish",
    "languages": ["fi"],
    "author": "AsmoKoskinen",
    "modelUrl": "hf://AsmoKoskinen/F5-TTS_Finnish_Model/model_common_voice_fi_vox_populi_fi_20241206.safetensors",
    "vocabUrl": "hf://AsmoKoskinen/F5-TTS_Finnish_Model/vocab.txt",
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
  {
    "id": "f5tts-base-fr",
    "name": "F5-TTS Base French",
    "languages": ["fr"],
    "author": "RASPIAUDIO",
    "modelUrl": "hf://RASPIAUDIO/F5-French-MixedSpeakers-reduced/model_last_reduced.pt",
    "vocabUrl": "hf://RASPIAUDIO/F5-French-MixedSpeakers-reduced/vocab.txt",
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
    {
    "id": "f5tts-small-hi",
    "name": "F5-TTS Small Hindi",
    "languages": ["hi"],
    "author": "SPRINGLab",
    "modelUrl": "hf://SPRINGLab/F5-Hindi-24KHz/model_2500000.safetensors",
    "vocabUrl": "hf://SPRINGLab/F5-Hindi-24KHz/vocab.txt",
    "config": {
      "dim": 768,
      "depth": 18,
      "heads": 12,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
    {
    "id": "f5tts-hu-mp3pintyo",
    "name": "F5-TTS Hungarian",
    "languages": ["hu"],
    "author": "mp3pintyo",
    "modelUrl": "hf://mp3pintyo/F5-TTS-Hun/model_1140000.safetensors",
    "vocabUrl": "hf://mp3pintyo/F5-TTS-Hun/vocab.txt",
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
  {
    "id": "f5tts-base-it",
    "name": "F5-TTS Base Italian",
    "languages": ["it"],
    "author": "alien79",
    "modelUrl": "hf://alien79/F5-TTS-italian/model_159600.safetensors",
    "vocabUrl": "hf://alien79/F5-TTS-italian/vocab.txt",
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
  {
    "id": "f5tts-base-ja",
    "name": "F5-TTS Base Japanese",
    "languages": ["ja"],
    "author": "Jmica",
    "modelUrl": "hf://Jmica/F5TTS/JA_21999120/model_21999120.pt",
    "vocabUrl": "hf://Jmica/F5TTS/JA_21999120/vocab_japanese.txt",
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
  {
    "id": "f5tts-pl-en-de", // Primarily pl
    "name": "F5-TTS Pl/En/De",
    "languages": ["pl", "en", "de"],
    "author": "Gregniuki",
    "modelUrl": "hf://Gregniuki/f5-tts_Polish_English_German/model_75000.safetensors", // Needs verification if this is the correct/latest model file
    "vocabUrl": "hf://Gregniuki/f5-tts_Polish_English_German/vocab.txt", // Needs verification
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
  {
    "id": "f5tts-pt-br-firstpixel",
    "name": "F5-TTS Portuguese (Brazilian)",
    "languages": ["pt-br"],
    "author": "firstpixel",
    "modelUrl": "hf://firstpixel/F5-TTS-pt-br/model.safetensors", // Placeholder filename, needs verification
    "vocabUrl": "hf://firstpixel/F5-TTS-pt-br/vocab.txt", // Placeholder filename, needs verification
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
  {
    "id": "f5tts-base-ru",
    "name": "F5-TTS Base Russian",
    "languages": ["ru"],
    "author": "HotDro4illa", // Note: User might be 'hotstone228' based on original list's URL
    "modelUrl": "hf://hotstone228/F5-TTS-Russian/model_last.safetensors",
    "vocabUrl": "hf://hotstone228/F5-TTS-Russian/vocab.txt",
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
  {
    "id": "erax-smile-unixsex-f5",
    "name": "EraX Smile UnixSex F5 (Vietnamese)",
    "languages": ["vi"],
    "author": "erax-ai",
    "modelUrl": "hf://erax-ai/EraX-Smile-UnixSex-F5/models/model_42000.safetensors",
    "vocabUrl": "hf://erax-ai/EraX-Smile-UnixSex-F5/models/vocab.txt",
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
  {
    "id": "f5tts-vi-toandev",
    "name": "F5-TTS Vietnamese (toandev)",
    "languages": ["vi"],
    "author": "toandev",
    "modelUrl": "hf://toandev/F5-TTS-Vietnamese/model_200000.safetensors", // Needs verification if this is the correct/latest model file
    "vocabUrl": "hf://toandev/F5-TTS-Vietnamese/vocab.txt", // Needs verification
    "config": {
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  },
  {
    "id": "erax-smile-female-f5-v1",
    "name": "EraX-Smile-Female-F5-V1.0",
    "languages": ["vi"],
    "author": "erax-ai",
    "modelUrl": "hf://erax-ai/EraX-Smile-Female-F5-V1.0/model_420000.safetensors", // Using available checkpoint
    "vocabUrl": "hf://erax-ai/EraX-Smile-Female-F5-V1.0/vocab.txt",
    "config": { // Assuming standard 'base' config
      "dim": 1024,
      "depth": 22,
      "heads": 16,
      "ff_mult": 2,
      "text_dim": 512,
      "text_mask_padding": false,
      "conv_layers": 4,
      "pe_attn_head": 1
    }
  }
];

// Language name mapping
const LANGUAGE_NAMES = {
  'ar': 'Arabic',
  'de': 'German',
  'en': 'English',
  'es': 'Spanish',
  'fi': 'Finnish',
  'fr': 'French',
  'hi': 'Hindi',
  'hu': 'Hungarian',
  'it': 'Italian',
  'ja': 'Japanese',
  'pl': 'Polish',
  'pt-br': 'Portuguese (BR)',
  'ru': 'Russian',
  'vi': 'Vietnamese',
  'zh': 'Chinese'
};

// Language color mapping
const LANGUAGE_COLORS = {
  'ar': 'warning',
  'de': 'info',
  'en': 'success',
  'es': 'success',
  'fi': 'info',
  'fr': 'secondary',
  'hi': 'warning',
  'hu': 'primary',
  'it': 'error',
  'ja': 'default',
  'pl': 'error',
  'pt-br': 'warning',
  'ru': 'primary',
  'vi': 'secondary',
  'zh': 'primary'
};

const ModelList = ({ onModelAdded, downloadingModels = {}, installedModels = [], onAddModelClick }) => {
  const { t } = useTranslation();
  const [downloading, setDownloading] = React.useState({});

  // Create a list of installed model IDs for filtering
  const installedModelIds = React.useMemo(() => {
    return installedModels.map(model => model.id);
  }, [installedModels]);

  const handleDownload = async (model) => {
    try {
      // Check if the model is already installed
      if (isModelInstalled(model.id)) {
        console.log(`Model ${model.id} is already installed, skipping download`);
        return;
      }

      setDownloading(prev => ({ ...prev, [model.id]: true }));

      // Prepare model data for API
      const modelData = {
        modelUrl: model.modelUrl,
        vocabUrl: model.vocabUrl,
        modelId: model.id,
        languageCodes: model.languages, // Include language codes
        config: model.config
      };

      // Call API to add model
      const response = await addModelFromHuggingFace(modelData);

      if (response.success) {
        // Invalidate the models cache to notify other components
        invalidateModelsCache();

        // Notify parent component
        if (onModelAdded) {
          onModelAdded(response.model_id);
        }
      }
    } catch (error) {
      console.error('Error downloading model:', error);
    } finally {
      setDownloading(prev => ({ ...prev, [model.id]: false }));
    }
  };

  // Handle cancelling a model download
  const handleCancelDownload = async (modelId) => {
    try {
      // Call API to cancel download
      const response = await cancelModelDownload(modelId);

      if (response.success) {
        console.log(`Download cancelled for model ${modelId}`);
        // Remove from local downloading state
        setDownloading(prev => {
          const newState = { ...prev };
          delete newState[modelId];
          return newState;
        });

        // Invalidate the models cache to notify other components
        invalidateModelsCache();

        // Notify parent component to refresh the model list
        if (onModelAdded) {
          onModelAdded();
        }
      }
    } catch (error) {
      console.error('Error cancelling model download:', error);
    }
  };

  // Check if a model is currently downloading
  const isDownloading = (modelId) => {
    return downloading[modelId] || (downloadingModels[modelId] && downloadingModels[modelId].status === 'downloading');
  };

  // Get download progress if available
  const getDownloadProgress = (modelId) => {
    if (downloadingModels[modelId] && downloadingModels[modelId].status === 'downloading') {
      return downloadingModels[modelId].progress || 0;
    }
    return 0;
  };

  // Check if a model is already installed
  const isModelInstalled = (modelId) => {
    return installedModelIds.includes(modelId);
  };

  return (
    <div className="model-management-section">
      <div className="section-header">
        <h4>{t('settings.modelManagement.availableModels')}</h4>
      </div>

      <div className="model-cards-container">
        {AVAILABLE_MODELS.filter(model => {
          // Always filter out models that are already installed
          if (isModelInstalled(model.id)) {
            return false;
          }

          // Special case: F5-TTS v1 Base should not be shown in available models
          // if there are no installed models, as it's the default model
          if (model.id === 'f5tts-v1-base' && installedModelIds.length === 0) {
            return false;
          }

          return true;
        }).map((model) => (
          <div className="model-card" key={model.id}>
            <div className="model-card-content">
              <h5 className="model-title">{model.name}</h5>
              <p className="model-author">{t('settings.modelManagement.by')} {model.author}</p>

              <div className="model-languages">
                {model.languages.map(lang => (
                  <span
                    key={lang}
                    className={`language-chip ${lang}`}
                  >
                    {LANGUAGE_NAMES[lang] || lang}
                  </span>
                ))}
              </div>
            </div>

            {isDownloading(model.id) ? (
              <div>
                <div className="download-progress">
                  <div
                    className="download-progress-bar"
                    style={{ width: `${getDownloadProgress(model.id)}%` }}
                  ></div>
                </div>
                <div className="model-card-actions">
                  <div className="download-percentage">
                    <span className="spinner"></span>
                    <span>{getDownloadProgress(model.id).toFixed(1)}%</span>
                  </div>
                  <button
                    className="cancel-download-btn"
                    onClick={() => handleCancelDownload(model.id)}
                    title={t('settings.modelManagement.cancelDownload', 'Cancel Download')}
                  >
                    <CancelIcon fontSize="small" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="model-card-actions">
                <button
                  className="download-model-btn"
                  onClick={() => handleDownload(model)}
                  title={t('settings.modelManagement.downloadModel')}
                >
                  <DownloadIcon fontSize="small" />
                  {t('settings.modelManagement.download')}
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add model card */}
        <div className="add-model-card" onClick={onAddModelClick}>
          <div className="add-model-icon">
            <AddIcon fontSize="large" />
          </div>
          <p>{t('settings.modelManagement.addCustomModel')}</p>
        </div>

        {AVAILABLE_MODELS.filter(model => !isModelInstalled(model.id)).length === 0 && (
          <div className="model-card">
            <p className="model-source" style={{ textAlign: 'center', padding: '2rem 0' }}>
              {t('settings.modelManagement.allModelsInstalled')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export { LANGUAGE_NAMES, LANGUAGE_COLORS, AVAILABLE_MODELS };
export default ModelList;
