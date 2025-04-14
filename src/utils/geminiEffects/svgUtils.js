/**
 * SVG utilities for Gemini button effects
 */

// Color schemes for particles
export const COLOR_SCHEMES = [
  // Default Gemini gradient
  {
    stops: [
      { offset: '0%', color: 'rgba(145, 104, 192, 0.8)' },
      { offset: '50%', color: 'rgba(86, 132, 209, 0.8)' },
      { offset: '100%', color: 'rgba(27, 161, 227, 0.8)' }
    ],
    stroke: 'currentColor',
    glow: null // Removed blue glow effect
  },
  // Purple-pink scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(171, 71, 188, 0.8)' },
      { offset: '100%', color: 'rgba(236, 64, 122, 0.8)' }
    ],
    stroke: 'rgba(236, 64, 122, 0.9)',
    glow: null // Removed pink glow effect
  },
  // Blue-green scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(3, 169, 244, 0.8)' },
      { offset: '100%', color: 'rgba(0, 150, 136, 0.8)' }
    ],
    stroke: 'rgba(0, 150, 136, 0.9)',
    glow: null // Removed blue-green glow effect
  },
  // Orange-red scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(255, 152, 0, 0.8)' },
      { offset: '100%', color: 'rgba(244, 67, 54, 0.8)' }
    ],
    stroke: 'rgba(244, 67, 54, 0.9)',
    glow: null // Removed orange-red glow effect
  },
  // Green-yellow scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(76, 175, 80, 0.8)' },
      { offset: '100%', color: 'rgba(255, 235, 59, 0.8)' }
    ],
    stroke: 'rgba(76, 175, 80, 0.9)',
    glow: null // Removed green-yellow glow effect
  },
  // Monochrome scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(255, 255, 255, 0.1)' },
      { offset: '100%', color: 'rgba(255, 255, 255, 0.6)' }
    ],
    stroke: 'rgba(255, 255, 255, 0.9)',
    glow: null // Removed white glow effect
  }
];

/**
 * Create the Gemini SVG markup with option for filled version
 * @param {boolean} isFilled - Whether to use filled version
 * @param {number} colorSchemeIndex - Index of color scheme to use
 * @returns {string} - SVG markup
 */
export const createGeminiSVG = (isFilled, colorSchemeIndex = 0) => {
  // Get color scheme (default to first scheme if invalid index)
  const scheme = COLOR_SCHEMES[colorSchemeIndex] || COLOR_SCHEMES[0];

  // Create gradient ID with random number to avoid conflicts
  const gradientId = `gemini-gradient-${Math.floor(Math.random() * 10000)}`;
  const fillValue = isFilled ? `url(#${gradientId})` : 'none';
  const strokeWidth = isFilled ? '1' : '1.5';

  // Generate gradient stops
  const gradientStops = scheme.stops.map(stop =>
    `<stop offset="${stop.offset}" stop-color="${stop.color}" />`
  ).join('');

  // Only use the standard Gemini icon path (no plus icons)
  const pathD = 'M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z';

  // Create a star-like glow effect
  const filterId = `star-glow-${Math.floor(Math.random() * 10000)}`;
  const glowColor = scheme.glow || 'rgba(255, 255, 255, 0.7)';

  // Create a radial star-like glow filter
  const filterDef = `
    <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      <feDropShadow dx="0" dy="0" stdDeviation="1.5" flood-color="${glowColor}" flood-opacity="0.7" />
    </filter>
  `;

  // Apply the filter
  const filterAttr = `filter="url(#${filterId})"`;

  return `<svg width="100%" height="100%" viewBox="0 0 28 28" fill="${fillValue}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
        ${gradientStops}
      </linearGradient>
      ${filterDef}
    </defs>
    <path d="${pathD}" stroke="none" ${filterAttr}/>
  </svg>`;
};

/**
 * Get size in pixels based on size class
 * @param {string} sizeClass - Size class name
 * @returns {number} - Size in pixels
 */
export const getSizeInPixels = (sizeClass) => {
  switch (sizeClass) {
    case 'size-xs': return 8;
    case 'size-sm': return 12;
    case 'size-md': return 16;
    case 'size-lg': return 20;
    default: return 14;
  }
};
