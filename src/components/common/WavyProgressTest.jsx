import { useRef, useState } from 'react';
import WavyProgressIndicator from './WavyProgressIndicator';

/**
 * Test component for the WavyProgressIndicator
 * This allows testing the React component within the actual app environment
 */
const WavyProgressTest = () => {
  const [progress, setProgress] = useState(0);
  const [waveSpeed, setWaveSpeed] = useState(1);
  const [isVisible, setIsVisible] = useState(true);
  const [theme, setTheme] = useState('light'); // light | dark
  const progressRef = useRef();

  const isDark = theme === 'dark';

  const handleSetProgress = (value) => {
    setProgress(value);
  };

  const handleSetWaveSpeed = (speed) => {
    setWaveSpeed(speed);
  };

  const handleEntrance = () => {
    progressRef.current?.startEntranceAnimation();
  };

  const handleDisappearance = () => {
    progressRef.current?.startDisappearanceAnimation();
  };

  const handleReset = () => {
    progressRef.current?.resetAnimationState();
    setProgress(0);
  };

  const runDemo = async () => {
    // Reset and start entrance
    progressRef.current?.resetAnimationState();
    progressRef.current?.startEntranceAnimation();

    await new Promise(resolve => setTimeout(resolve, 600));
    setProgress(0.2);

    await new Promise(resolve => setTimeout(resolve, 800));
    setProgress(0.6);

    await new Promise(resolve => setTimeout(resolve, 800));
    setProgress(0.9);

    await new Promise(resolve => setTimeout(resolve, 800));
    setProgress(1.0);

    await new Promise(resolve => setTimeout(resolve, 1500));
    progressRef.current?.startDisappearanceAnimation();

    await new Promise(resolve => setTimeout(resolve, 1000));
    progressRef.current?.resetAnimationState();
    setProgress(0);
  };

  if (!isVisible) return null;

  const palette = isDark ? {
    bg: '#1d212b',
    surface: '#222737',
    text: '#E6E9F5',
    subtext: '#98a0b3',
    border: '#4f5a77',
    accent: '#B0C6FF',
    track: '#404659'
  } : {
    bg: 'white',
    surface: '#f8f9fa',
    text: '#2d3553',
    subtext: '#666',
    border: '#485E92',
    accent: '#485E92',
    track: '#D9DFF6'
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: palette.bg,
      padding: '20px',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 9999,
      minWidth: '340px',
      border: `2px solid ${palette.border}`,
      color: palette.text
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px'
      }}>
        <h3 style={{ margin: 0, color: palette.accent, fontSize: '16px' }}>
          🌊 Wavy Progress Test
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, color: palette.subtext }}>Theme</label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              border: `1px solid ${palette.border}`,
              background: palette.surface,
              color: palette.text,
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <button
            onClick={() => setIsVisible(false)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: palette.subtext
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Progress Indicator */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '20px',
        background: palette.surface,
        borderRadius: '8px',
        marginBottom: '15px'
      }}>
        <WavyProgressIndicator
          ref={progressRef}
          progress={progress}
          animate={true}
          showStopIndicator={true}
          waveSpeed={waveSpeed}
          progressAnimationDuration={500}
          color={palette.accent}
          trackColor={palette.track}
        />
      </div>

      {/* Progress Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '8px',
        marginBottom: '15px'
      }}>
        <button onClick={() => handleSetProgress(0)} style={buttonStyle(palette)}>0%</button>
        <button onClick={() => handleSetProgress(0.25)} style={buttonStyle(palette)}>25%</button>
        <button onClick={() => handleSetProgress(0.5)} style={buttonStyle(palette)}>50%</button>
        <button onClick={() => handleSetProgress(0.75)} style={buttonStyle(palette)}>75%</button>
        <button onClick={() => handleSetProgress(1)} style={buttonStyle(palette)}>100%</button>
      </div>

      {/* Animation Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        marginBottom: '15px'
      }}>
        <button onClick={handleEntrance} style={buttonStyle(palette)}>🎬 Entrance</button>
        <button onClick={handleDisappearance} style={buttonStyle(palette)}>👻 Disappear</button>
        <button onClick={handleReset} style={buttonStyle(palette)}>🔄 Reset</button>
        <button onClick={runDemo} style={{...buttonStyle(palette), background: `linear-gradient(45deg, ${palette.accent}, #6c7eb8)`}}>
          ✨ Demo
        </button>
      </div>

      {/* Sliders */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500', color: palette.subtext }}>
          Progress: {Math.round(progress * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={progress * 100}
          onChange={(e) => handleSetProgress(e.target.value / 100)}
          style={{ width: '100%' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500', color: palette.subtext }}>
          Wave Speed: {waveSpeed.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="3"
          step="0.1"
          value={waveSpeed}
          onChange={(e) => handleSetWaveSpeed(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{
        marginTop: '15px',
        padding: '10px',
        background: isDark ? '#1f2a1f' : '#e8f5e8',
        borderRadius: '6px',
        fontSize: '12px',
        color: isDark ? '#b8e0b8' : '#2e7d32'
      }}>
        ✅ Testing React WavyProgressIndicator in your app!
      </div>
    </div>
  );
};

const buttonStyle = (palette) => ({
  padding: '8px 12px',
  border: 'none',
  borderRadius: '6px',
  background: palette.accent,
  color: 'white',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '500',
  transition: 'all 0.2s ease'
});

export default WavyProgressTest;
