import React, { useRef, useState } from 'react';
import WavyProgressIndicator from './WavyProgressIndicator';

/**
 * Test component for the WavyProgressIndicator
 * This allows testing the React component within the actual app environment
 */
const WavyProgressTest = () => {
  const [progress, setProgress] = useState(0);
  const [waveSpeed, setWaveSpeed] = useState(1);
  const [isVisible, setIsVisible] = useState(true);
  const progressRef = useRef();

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

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: 'white',
      padding: '20px',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 9999,
      minWidth: '320px',
      border: '2px solid #485E92'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px'
      }}>
        <h3 style={{ margin: 0, color: '#485E92', fontSize: '16px' }}>
          🌊 Wavy Progress Test
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          ×
        </button>
      </div>

      {/* Progress Indicator */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '20px',
        background: '#f8f9fa',
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
        />
      </div>

      {/* Progress Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '8px',
        marginBottom: '15px'
      }}>
        <button onClick={() => handleSetProgress(0)} style={buttonStyle}>0%</button>
        <button onClick={() => handleSetProgress(0.25)} style={buttonStyle}>25%</button>
        <button onClick={() => handleSetProgress(0.5)} style={buttonStyle}>50%</button>
        <button onClick={() => handleSetProgress(0.75)} style={buttonStyle}>75%</button>
        <button onClick={() => handleSetProgress(1)} style={buttonStyle}>100%</button>
      </div>

      {/* Animation Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        marginBottom: '15px'
      }}>
        <button onClick={handleEntrance} style={buttonStyle}>🎬 Entrance</button>
        <button onClick={handleDisappearance} style={buttonStyle}>👻 Disappear</button>
        <button onClick={handleReset} style={buttonStyle}>🔄 Reset</button>
        <button onClick={runDemo} style={{...buttonStyle, background: 'linear-gradient(45deg, #485E92, #6c7eb8)'}}>
          ✨ Demo
        </button>
      </div>

      {/* Sliders */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
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
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
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
        background: '#e8f5e8',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#2e7d32'
      }}>
        ✅ Testing React WavyProgressIndicator in your app!
      </div>
    </div>
  );
};

const buttonStyle = {
  padding: '8px 12px',
  border: 'none',
  borderRadius: '6px',
  background: '#485E92',
  color: 'white',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '500',
  transition: 'all 0.2s ease'
};

export default WavyProgressTest;
