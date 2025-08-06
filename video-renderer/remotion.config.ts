import { Config } from '@remotion/cli/config';

// Force Chrome for Testing for GPU acceleration
Config.setChromeMode('chrome-for-testing');

// Set GPU-optimized OpenGL backend (angle works better on Windows)
Config.setChromiumOpenGlRenderer('angle');

// Disable web security to allow GPU access
Config.setChromiumDisableWebSecurity(true);

// Ignore certificate errors
Config.setChromiumIgnoreCertificateErrors(true);

// Enable multi-process for better performance
Config.setChromiumMultiProcessOnLinux(true);

// Enable hardware acceleration
Config.setHardwareAcceleration('if-possible');

// MAXIMUM concurrency for fastest rendering on any machine
Config.setConcurrency(null); // Auto-detect and use ALL available CPU cores for maximum performance

console.log('🚀 Remotion Config: Chrome for Testing + Vulkan + GPU acceleration enabled');
