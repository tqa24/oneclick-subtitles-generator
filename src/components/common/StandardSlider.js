import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Component property mapping system for Figma variants
 */
const FIGMA_COMPONENT_PROPERTIES = {
  orientation: {
    horizontal: 'Horizontal',
    vertical: 'Vertical'
  },
  size: {
    xsmall: 'XSmall',
    small: 'Small',
    medium: 'Medium',
    large: 'Large'
  },
  state: {
    enabled: 'Enabled',
    disabled: 'Disabled',
    hover: 'Hover',
    focus: 'Focus'
  },
  value: {
    0: '0',
    25: '25',
    50: '50',
    75: '75',
    100: '100'
  }
};

/**
 * StandardSlider component based on Figma design
 * Implements the Standard slider component with all variants and properties
 * Matches Figma component: "Standard slider" with variants and properties
 *
 * @param {Object} props - Component props
 * @param {number} props.value - Current slider value (0-100)
 * @param {Function} props.onChange - Callback when value changes
 * @param {number} props.min - Minimum value (default: 0)
 * @param {number} props.max - Maximum value (default: 100)
 * @param {number} props.step - Step increment (default: 1)
 * @param {string} props.orientation - 'horizontal' or 'vertical' (default: 'horizontal')
 * @param {string} props.size - 'xsmall', 'small', 'medium', 'large' (default: 'xsmall')
 * @param {string} props.state - 'enabled', 'disabled', 'hover', 'focus' (default: 'enabled')
 * @param {string} props.width - 'auto', 'full', 'compact' (default: 'auto')
 * @param {boolean} props.showValueIndicator - Show value display (default: true)
 * @param {boolean} props.showIcon - Show icon (default: false)
 * @param {boolean} props.showStops - Show track stops (default: false)
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.id - Input ID for accessibility
 * @param {string} props.ariaLabel - Aria label for accessibility
 * @param {Function} props.onDragStart - Callback when dragging starts
 * @param {Function} props.onDragEnd - Callback when dragging ends
 * @param {Object} props.figmaProps - Direct Figma component properties override
 * @returns {JSX.Element} - Rendered StandardSlider component
 */
const StandardSlider = ({
  value = 50, // Figma default
  onChange,
  min = 0,
  max = 100,
  step = 1,
  orientation = 'Horizontal', // Figma default (capitalized)
  size = 'XSmall', // Figma default (capitalized)
  state = 'Enabled', // Figma default (capitalized)
  width = 'auto', // Width variant: 'auto', 'full', 'compact'
  showValueIndicator = true, // Figma default
  showIcon = false, // Figma default
  showStops = false, // Figma default
  className = '',
  id,
  ariaLabel,
  onDragStart,
  onDragEnd,
  figmaProps = {},
  ...props
}) => {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Apply Figma component properties if provided
  const resolvedProps = {
    orientation: figmaProps.Orientation || orientation,
    size: figmaProps.Size || size,
    state: figmaProps.State || state,
    width: figmaProps.Width || width, // Support Figma width variants
    showValueIndicator: figmaProps['Show value indicator'] !== undefined
      ? figmaProps['Show value indicator']
      : showValueIndicator,
    showIcon: figmaProps['Show icon'] !== undefined
      ? figmaProps['Show icon']
      : showIcon,
    showStops: figmaProps['Show stops'] !== undefined
      ? figmaProps['Show stops']
      : showStops,
    value: figmaProps.Value !== undefined
      ? parseInt(figmaProps.Value)
      : value
  };

  // Calculate percentage from resolved value
  const percentage = ((resolvedProps.value - min) / (max - min)) * 100;

  // Calculate active track flex-grow for Material 3 layout with gaps
  // The handle sits between tracks, so we need to account for spacing
  const activeTrackFlex = percentage / 100; // Convert percentage to flex ratio
  const inactiveTrackFlex = (100 - percentage) / 100;

  // Hide end stop when handle is close to the end (Material Design 3 behavior)
  const shouldHideEndStop = percentage > 85; // Hide when >85% to avoid visual clutter

  // Handle value change
  const handleChange = (e) => {
    const newValue = parseFloat(e.target.value);
    if (onChange) {
      onChange(newValue);
    }
  };

  // Get Figma component name for debugging/logging
  const getFigmaComponentName = () => {
    const orientationName = FIGMA_COMPONENT_PROPERTIES.orientation[resolvedProps.orientation.toLowerCase()] || resolvedProps.orientation;
    const sizeName = FIGMA_COMPONENT_PROPERTIES.size[resolvedProps.size.toLowerCase()] || resolvedProps.size;
    const stateName = FIGMA_COMPONENT_PROPERTIES.state[resolvedProps.state.toLowerCase()] || resolvedProps.state;
    const valueName = FIGMA_COMPONENT_PROPERTIES.value[Math.round(resolvedProps.value)] || Math.round(resolvedProps.value);

    return `Orientation=${orientationName}, Size=${sizeName}, State=${stateName}, Value=${valueName}`;
  };

  // Handle drag start
  const handleDragStart = () => {
    setIsDragging(true);
    if (onDragStart) {
      onDragStart();
    }
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
    if (onDragEnd) {
      onDragEnd();
    }
  };

  // Add drag event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const input = container.querySelector('.standard-slider-input');
    if (!input) return;

    // Mouse events
    input.addEventListener('mousedown', handleDragStart);
    input.addEventListener('change', handleDragEnd);

    // Touch events for mobile
    input.addEventListener('touchstart', handleDragStart);
    input.addEventListener('touchend', handleDragEnd);

    // Global mouse/touch end events
    const handleGlobalEnd = () => {
      handleDragEnd();
    };

    document.addEventListener('mouseup', handleGlobalEnd);
    document.addEventListener('touchend', handleGlobalEnd);

    return () => {
      input.removeEventListener('mousedown', handleDragStart);
      input.removeEventListener('change', handleDragEnd);
      input.removeEventListener('touchstart', handleDragStart);
      input.removeEventListener('touchend', handleDragEnd);
      document.removeEventListener('mouseup', handleGlobalEnd);
      document.removeEventListener('touchend', handleGlobalEnd);
    };
  }, []);

  // Build CSS classes using resolved props (support both lowercase and Figma capitalized)
  const containerClasses = [
    'standard-slider-container',
    `width-${resolvedProps.width}`, // Width variant class
    `orientation-${resolvedProps.orientation}`, // Keep original case from Figma
    `size-${resolvedProps.size}`, // Keep original case from Figma
    `state-${resolvedProps.state}`, // Keep original case from Figma
    resolvedProps.state.toLowerCase() === 'disabled' ? 'disabled' : '',
    resolvedProps.state.toLowerCase() === 'hover' ? 'hover' : '',
    resolvedProps.state.toLowerCase() === 'focus' ? 'focus' : '',
    isDragging ? 'dragging' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div 
      ref={containerRef}
      className={containerClasses}
      {...props}
    >
      {/* Track container with active track, handle, and inactive track */}
      <div className="standard-slider-track-container">
        {/* Active track (left portion) - uses flex-grow based on value */}
        <div
          className="standard-slider-active-track"
          style={{
            flexGrow: activeTrackFlex,
            flexShrink: 0,
            flexBasis: 0
          }}
        >
          <div className="track"></div>
        </div>

        {/* Handle - positioned in flex layout between tracks */}
        <div className="standard-slider-handle">
          {/* Value badge that appears when dragging */}
          <div className="standard-slider-value-badge">
            {step < 1 ? parseFloat(resolvedProps.value).toFixed(2) : Math.round(resolvedProps.value)}
          </div>
        </div>

        {/* Inactive track (right portion) - uses flex-grow for remaining space */}
        <div
          className="standard-slider-inactive-track"
          style={{
            flexGrow: inactiveTrackFlex,
            flexShrink: 0,
            flexBasis: 0
          }}
        >
          <div className="track"></div>

          {/* Track stops if enabled */}
          {resolvedProps.showStops && (
            <div
              className="standard-slider-track-stop"
              style={{
                left: '161px' // Figma absolute position
              }}
            >
              <div className="dot"></div>
            </div>
          )}

          {/* End stop - Material Design 3 dot at end of track */}
          <div
            className={`standard-slider-end-stop ${shouldHideEndStop ? 'hidden' : ''}`}
          ></div>
        </div>

        {/* Hidden input for interaction - covers entire track container */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={resolvedProps.value}
          onChange={handleChange}
          className="standard-slider-input"
          id={id}
          aria-label={ariaLabel || t('common.slider', 'Slider')}
          disabled={resolvedProps.state === 'disabled'}
          data-figma-component={getFigmaComponentName()}
        />
      </div>

      {/* Value indicator if enabled */}
      {resolvedProps.showValueIndicator && (
        <div className="standard-slider-value-indicator">
          {step < 1 ? parseFloat(resolvedProps.value).toFixed(2) : Math.round(resolvedProps.value)}{max <= 1 ? '' : '%'}
        </div>
      )}

      {/* Icon if enabled */}
      {resolvedProps.showIcon && (
        <div className="standard-slider-icon">
          {/* Icon implementation would go here */}
        </div>
      )}
    </div>
  );
};

export default StandardSlider;
