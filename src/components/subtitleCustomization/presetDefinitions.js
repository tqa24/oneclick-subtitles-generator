import { presetsPartA } from './presetsPartA';
import { presetsPartB } from './presetsPartB';

// All predefined presets. Pure-data definitions are split across presetsPartA/B to keep each
// file under the 600-line limit; this module composes and re-exposes them (order preserved).
export const presets = { ...presetsPartA, ...presetsPartB };

// Ordered list of predefined preset keys (drives button render order).
export const presetOrder = [
  'default', 'modern', 'classic', 'neon', 'minimal', 'gaming', 'cinematic',
  'gradient', 'retro', 'elegant', 'cyberpunk', 'vintage', 'comic', 'horror',
  'luxury', 'kawaii', 'grunge', 'corporate', 'anime', 'vaporwave', 'steampunk',
  'noir', 'pastel', 'bold', 'sketch', 'glitch', 'royal', 'sunset', 'ocean', 'forest'
];
