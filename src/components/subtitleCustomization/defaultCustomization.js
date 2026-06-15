// Default subtitle customization configuration.
// Leaf module (no imports) so it is never in a temporal dead zone for modules that spread it
// at evaluation time (e.g. presetDefinitions.js) under the panel<->controls import cycle.
export const defaultCustomization = {
  // Text properties
  fontSize: 28,
  fontFamily: "'Arial', sans-serif",
  fontWeight: 400,
  textColor: '#ffffff',
  textAlign: 'center',
  lineHeight: 1.2,
  letterSpacing: 0,
  textTransform: 'none',

  // Background properties
  backgroundColor: '#000000',
  backgroundOpacity: 70,
  borderRadius: 4,
  borderWidth: 0,
  borderColor: '#ffffff',
  borderStyle: 'none',

  // Shadow and effects
  textShadowEnabled: true,
  textShadowColor: '#000000',
  textShadowBlur: 4,
  textShadowOffsetX: 0,
  textShadowOffsetY: 2,
  glowEnabled: false,
  glowColor: '#ffffff',
  glowIntensity: 10,

  // Gradient effects
  gradientEnabled: false,
  gradientType: 'linear',
  gradientDirection: '45deg',
  gradientColorStart: '#ffffff',
  gradientColorEnd: '#cccccc',
  gradientColorMid: '#eeeeee',

  // Advanced text effects
  strokeEnabled: false,
  strokeWidth: 0,
  strokeColor: '#000000',
  multiShadowEnabled: false,
  shadowLayers: 1,

  // Kinetic effects
  pulseEnabled: false,
  pulseSpeed: 1,
  shakeEnabled: false,
  shakeIntensity: 2,

  // Position
  position: 'bottom',
  customPositionX: 50,
  customPositionY: 80,
  marginBottom: 80,
  marginTop: 80,
  marginLeft: 0,
  marginRight: 0,
  maxWidth: 80,

  // Animation
  fadeInDuration: 0.3,
  fadeOutDuration: 0.3,
  animationType: 'fade',
  animationEasing: 'ease',

  // Text wrapping
  wordWrap: true,
  maxLines: 3,
  lineBreakBehavior: 'auto',
  rtlSupport: false,

  preset: 'default'
};
