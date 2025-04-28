import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Chip,
  CircularProgress,
  Tooltip
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { addModelFromHuggingFace } from '../../services/modelService';

// List of available models from F5-TTS SHARED.md
const AVAILABLE_MODELS = [
  {
    id: 'f5tts-v1-base',
    name: 'F5-TTS v1 Base',
    languages: ['zh', 'en'],
    author: 'F5-TTS',
    modelUrl: 'hf://SWivid/F5-TTS/F5TTS_v1_Base/model_1250000.safetensors',
    vocabUrl: 'hf://SWivid/F5-TTS/F5TTS_v1_Base/vocab.txt',
    config: {
      dim: 1024,
      depth: 22,
      heads: 16,
      ff_mult: 2,
      text_dim: 512,
      conv_layers: 4
    }
  },
  {
    id: 'f5tts-base',
    name: 'F5-TTS Base',
    languages: ['zh', 'en'],
    author: 'F5-TTS',
    modelUrl: 'hf://SWivid/F5-TTS/F5TTS_Base/model_1200000.safetensors',
    vocabUrl: 'hf://SWivid/F5-TTS/F5TTS_Base/vocab.txt',
    config: {
      dim: 1024,
      depth: 22,
      heads: 16,
      ff_mult: 2,
      text_dim: 512,
      text_mask_padding: false,
      conv_layers: 4,
      pe_attn_head: 1
    }
  },
  {
    id: 'f5tts-base-fi',
    name: 'F5-TTS Base Finnish',
    languages: ['fi'],
    author: 'AsmoKoskinen',
    modelUrl: 'hf://AsmoKoskinen/F5-TTS_Finnish_Model/model_common_voice_fi_vox_populi_fi_20241206.safetensors',
    vocabUrl: 'hf://AsmoKoskinen/F5-TTS_Finnish_Model/vocab.txt',
    config: {
      dim: 1024,
      depth: 22,
      heads: 16,
      ff_mult: 2,
      text_dim: 512,
      text_mask_padding: false,
      conv_layers: 4,
      pe_attn_head: 1
    }
  },
  {
    id: 'f5tts-base-fr',
    name: 'F5-TTS Base French',
    languages: ['fr'],
    author: 'RASPIAUDIO',
    modelUrl: 'hf://RASPIAUDIO/F5-French-MixedSpeakers-reduced/model_last_reduced.pt',
    vocabUrl: 'hf://RASPIAUDIO/F5-French-MixedSpeakers-reduced/vocab.txt',
    config: {
      dim: 1024,
      depth: 22,
      heads: 16,
      ff_mult: 2,
      text_dim: 512,
      text_mask_padding: false,
      conv_layers: 4,
      pe_attn_head: 1
    }
  },
  {
    id: 'f5tts-small-hi',
    name: 'F5-TTS Small Hindi',
    languages: ['hi'],
    author: 'SPRINGLab',
    modelUrl: 'hf://SPRINGLab/F5-Hindi-24KHz/model_2500000.safetensors',
    vocabUrl: 'hf://SPRINGLab/F5-Hindi-24KHz/vocab.txt',
    config: {
      dim: 768,
      depth: 18,
      heads: 12,
      ff_mult: 2,
      text_dim: 512,
      text_mask_padding: false,
      conv_layers: 4,
      pe_attn_head: 1
    }
  },
  {
    id: 'f5tts-base-it',
    name: 'F5-TTS Base Italian',
    languages: ['it'],
    author: 'alien79',
    modelUrl: 'hf://alien79/F5-TTS-italian/model_159600.safetensors',
    vocabUrl: 'hf://alien79/F5-TTS-italian/vocab.txt',
    config: {
      dim: 1024,
      depth: 22,
      heads: 16,
      ff_mult: 2,
      text_dim: 512,
      text_mask_padding: false,
      conv_layers: 4,
      pe_attn_head: 1
    }
  },
  {
    id: 'f5tts-base-ja',
    name: 'F5-TTS Base Japanese',
    languages: ['ja'],
    author: 'Jmica',
    modelUrl: 'hf://Jmica/F5TTS/JA_21999120/model_21999120.pt',
    vocabUrl: 'hf://Jmica/F5TTS/JA_21999120/vocab_japanese.txt',
    config: {
      dim: 1024,
      depth: 22,
      heads: 16,
      ff_mult: 2,
      text_dim: 512,
      text_mask_padding: false,
      conv_layers: 4,
      pe_attn_head: 1
    }
  },
  {
    id: 'f5tts-base-ru',
    name: 'F5-TTS Base Russian',
    languages: ['ru'],
    author: 'HotDro4illa',
    modelUrl: 'hf://hotstone228/F5-TTS-Russian/model_last.safetensors',
    vocabUrl: 'hf://hotstone228/F5-TTS-Russian/vocab.txt',
    config: {
      dim: 1024,
      depth: 22,
      heads: 16,
      ff_mult: 2,
      text_dim: 512,
      text_mask_padding: false,
      conv_layers: 4,
      pe_attn_head: 1
    }
  },
  {
    id: 'f5tts-base-es',
    name: 'F5-TTS Base Spanish',
    languages: ['es'],
    author: 'jpgallegoar',
    modelUrl: 'hf://jpgallegoar/F5-Spanish/model.safetensors',
    vocabUrl: 'hf://jpgallegoar/F5-Spanish/vocab.txt',
    config: {
      dim: 1024,
      depth: 22,
      heads: 16,
      ff_mult: 2,
      text_dim: 512,
      text_mask_padding: false,
      conv_layers: 4,
      pe_attn_head: 1
    }
  },
  // Add Vietnamese model if available
  {
    id: 'erax-smile-unixsex-f5',
    name: 'EraX Smile UnixSex F5',
    languages: ['vi'],
    author: 'EraX',
    modelUrl: 'custom://EraX-Smile-UnixSex-F5/model_42000.safetensors',
    vocabUrl: 'custom://EraX-Smile-UnixSex-F5/vocab.txt',
    config: {
      dim: 1024,
      depth: 22,
      heads: 16,
      ff_mult: 2,
      text_dim: 512,
      text_mask_padding: false,
      conv_layers: 4,
      pe_attn_head: 1
    }
  }
];

// Language name mapping
const LANGUAGE_NAMES = {
  'zh': 'Chinese',
  'en': 'English',
  'fi': 'Finnish',
  'fr': 'French',
  'hi': 'Hindi',
  'it': 'Italian',
  'ja': 'Japanese',
  'ru': 'Russian',
  'es': 'Spanish',
  'vi': 'Vietnamese'
};

// Language color mapping
const LANGUAGE_COLORS = {
  'zh': 'primary',
  'en': 'success',
  'fi': 'info',
  'fr': 'secondary',
  'hi': 'warning',
  'it': 'error',
  'ja': 'default',
  'ru': 'primary',
  'es': 'success',
  'vi': 'secondary'
};

const ModelList = ({ onModelAdded, downloadingModels = {} }) => {
  const { t } = useTranslation();
  const [downloading, setDownloading] = React.useState({});

  const handleDownload = async (model) => {
    try {
      setDownloading(prev => ({ ...prev, [model.id]: true }));
      
      // Prepare model data for API
      const modelData = {
        modelUrl: model.modelUrl,
        vocabUrl: model.vocabUrl,
        modelId: model.id,
        config: model.config
      };
      
      // Call API to add model
      const response = await addModelFromHuggingFace(modelData);
      
      if (response.success) {
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

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t('settings.modelManagement.availableModels')}
      </Typography>
      
      <Grid container spacing={2}>
        {AVAILABLE_MODELS.map((model) => (
          <Grid item xs={12} sm={6} md={4} key={model.id}>
            <Paper 
              elevation={1} 
              sx={{ 
                p: 2, 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                position: 'relative'
              }}
            >
              <Typography variant="subtitle1" gutterBottom>
                {model.name}
              </Typography>
              
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {t('settings.modelManagement.by')} {model.author}
              </Typography>
              
              <Box sx={{ mb: 2, mt: 1 }}>
                {model.languages.map(lang => (
                  <Chip 
                    key={lang}
                    label={LANGUAGE_NAMES[lang] || lang}
                    size="small"
                    color={LANGUAGE_COLORS[lang] || 'default'}
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Box>
              
              <Box sx={{ mt: 'auto' }}>
                <Tooltip title={t('settings.modelManagement.downloadModel')}>
                  <span>
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={isDownloading(model.id) ? 
                        <CircularProgress size={20} /> : 
                        <DownloadIcon />
                      }
                      onClick={() => handleDownload(model)}
                      disabled={isDownloading(model.id)}
                      fullWidth
                    >
                      {isDownloading(model.id) 
                        ? `${t('settings.modelManagement.downloading')} (${getDownloadProgress(model.id)}%)`
                        : t('settings.modelManagement.download')
                      }
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ModelList;
