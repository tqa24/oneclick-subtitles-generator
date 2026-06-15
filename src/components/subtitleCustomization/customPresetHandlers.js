import { defaultCustomization } from '../SubtitleCustomizationPanel';
import { presets } from './presetDefinitions';

// Pure helpers for resolving/applying subtitle presets.
// None of these close over component state — needed values are passed in.

// Resolve a predefined preset key to a full customization object.
// Ensures all properties are reset to prevent bleeding between presets.
export const resolvePreset = (preset) => {
  const presetConfig = presets[preset] || presets.default;
  return { ...defaultCustomization, ...presetConfig };
};

// Resolve a custom preset to a full customization object.
export const resolveCustomPreset = (customPreset) => {
  return { ...defaultCustomization, ...customPreset.customization, preset: customPreset.id };
};

// Build the payload used to persist a new custom preset.
export const buildSavePayload = (presetName, customization) => {
  return {
    name: presetName,
    customization: { ...customization }
  };
};
