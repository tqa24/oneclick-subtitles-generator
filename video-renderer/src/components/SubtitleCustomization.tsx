import React, { useState } from 'react';
import styled from 'styled-components';
import { useLanguage } from '../contexts/LanguageContext';
import { SubtitleCustomization } from '../types';
import CustomDropdown from './CustomDropdown';

// Default customization settings
export const defaultCustomization: SubtitleCustomization = {
  fontSize: 28,
  fontFamily: 'Inter',
  fontWeight: 600,
  textColor: '#ffffff',
  textAlign: 'center',
  lineHeight: 1.2,
  letterSpacing: 0,
  textTransform: 'none',

  backgroundColor: '#000000',
  backgroundOpacity: 50,
  borderRadius: 4,
  borderWidth: 0,
  borderColor: '#ffffff',
  borderStyle: 'none',

  textShadowEnabled: true,
  textShadowColor: '#000000',
  textShadowBlur: 4,
  textShadowOffsetX: 0,
  textShadowOffsetY: 2,
  glowEnabled: false,
  glowColor: '#ffffff',
  glowIntensity: 10,

  // Advanced gradient effects
  gradientEnabled: false,
  gradientType: 'linear',
  gradientDirection: '45deg',
  gradientColorStart: '#ffffff',
  gradientColorEnd: '#cccccc',
  gradientColorMid: '#eeeeee',

  // Advanced text effects
  strokeEnabled: false,
  strokeWidth: 2,
  strokeColor: '#000000',
  multiShadowEnabled: false,
  shadowLayers: 1,

  // Kinetic effects
  pulseEnabled: false,
  pulseSpeed: 1,
  shakeEnabled: false,
  shakeIntensity: 2,

  position: 'bottom',
  customPositionX: 50,
  customPositionY: 80,
  marginBottom: 80,
  marginTop: 80,
  marginLeft: 0,
  marginRight: 0,
  maxWidth: 80,

  fadeInDuration: 0.3,
  fadeOutDuration: 0.3,
  animationType: 'fade',
  animationEasing: 'ease',

  wordWrap: true,
  maxLines: 3,
  lineBreakBehavior: 'auto',
  rtlSupport: false,

  preset: 'default'
};

interface SubtitleCustomizationProps {
  customization: SubtitleCustomization;
  onChange: (customization: SubtitleCustomization) => void;
}

const CustomizationContainer = styled.div`
  background: var(--card-background);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid var(--border-color);
`;

const SectionTitle = styled.h3`
  margin: 0 0 15px 0;
  color: var(--heading-color);
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ControlGroup = styled.div`
  margin-bottom: 20px;
`;

const ControlRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 15px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ControlItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const Label = styled.label`
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-color);
`;

const Input = styled.input`
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-background);
  color: var(--text-color);
  font-size: 0.9rem;

  &:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(var(--accent-color-rgb), 0.2);
  }
`;



const ColorInput = styled.input`
  width: 50px;
  height: 35px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  &::-webkit-color-swatch {
    border: none;
    border-radius: 3px;
  }
`;

const RangeInput = styled.input`
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--border-color);
  outline: none;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent-color);
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent-color);
    cursor: pointer;
    border: none;
  }
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  accent-color: var(--accent-color);
`;

const PresetButton = styled.button<{ $active: boolean }>`
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: ${props => props.$active ? 'var(--accent-color)' : 'var(--card-background)'};
  color: ${props => props.$active ? 'white' : 'var(--text-color)'};
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$active ? 'var(--accent-color)' : 'var(--hover-color)'};
  }
`;

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
`;

const CollapsibleSection = styled.div<{ $expanded: boolean }>`
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 15px;
  overflow: hidden;
`;

const SectionHeader = styled.div`
  padding: 12px 16px;
  background: var(--hover-color);
  cursor: pointer;
  display: flex;
  justify-content: between;
  align-items: center;
  font-weight: 500;

  &:hover {
    background: var(--hover-color-darker);
  }
`;

const SectionContent = styled.div<{ $expanded: boolean }>`
  padding: ${props => props.$expanded ? '16px' : '0'};
  max-height: ${props => props.$expanded ? '1000px' : '0'};
  overflow: hidden;
  transition: all 0.3s ease;
`;



const SubtitleCustomizationPanel: React.FC<SubtitleCustomizationProps> = ({
  customization,
  onChange
}) => {
  const { t } = useLanguage();
  const [expandedSections, setExpandedSections] = useState({
    presets: true,
    text: true,
    background: false,
    effects: false,
    position: false,
    animation: false,
    advanced: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateCustomization = (updates: Partial<SubtitleCustomization>) => {
    onChange({ ...customization, ...updates, preset: 'custom' });
  };

  const applyPreset = (preset: SubtitleCustomization['preset']) => {
    const presets: Record<string, Partial<SubtitleCustomization>> = {
      default: defaultCustomization,
      modern: {
        ...defaultCustomization,
        fontFamily: 'Roboto',
        fontSize: 32,
        fontWeight: 400,
        backgroundColor: '#1a1a1a',
        backgroundOpacity: 80,
        borderRadius: 8,
        textShadowEnabled: false,
        preset: 'modern'
      },
      classic: {
        ...defaultCustomization,
        fontFamily: 'Times New Roman',
        fontSize: 30,
        fontWeight: 700,
        textColor: '#ffff00',
        backgroundColor: '#000000',
        backgroundOpacity: 70,
        borderRadius: 0,
        textShadowEnabled: true,
        textShadowColor: '#000000',
        textShadowBlur: 6,
        preset: 'classic'
      },
      neon: {
        ...defaultCustomization,
        fontFamily: 'Arial',
        fontSize: 34,
        fontWeight: 700,
        textColor: '#00ffff',
        backgroundColor: '#000000',
        backgroundOpacity: 90,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#00ffff',
        borderStyle: 'solid',
        glowEnabled: true,
        glowColor: '#00ffff',
        glowIntensity: 15,
        preset: 'neon'
      },
      minimal: {
        ...defaultCustomization,
        fontFamily: 'Helvetica',
        fontSize: 26,
        fontWeight: 300,
        backgroundColor: 'transparent',
        backgroundOpacity: 0,
        borderRadius: 0,
        textShadowEnabled: true,
        textShadowColor: '#000000',
        textShadowBlur: 8,
        preset: 'minimal'
      },
      bold: {
        ...defaultCustomization,
        fontFamily: 'Impact',
        fontSize: 36,
        fontWeight: 900,
        textTransform: 'uppercase',
        backgroundColor: '#ff0000',
        backgroundOpacity: 85,
        borderRadius: 6,
        textShadowEnabled: true,
        textShadowBlur: 3,
        preset: 'bold'
      },
      elegant: {
        ...defaultCustomization,
        fontFamily: 'Georgia',
        fontSize: 28,
        fontWeight: 400,
        textColor: '#f5f5f5',
        backgroundColor: '#2c2c2c',
        backgroundOpacity: 75,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#gold',
        borderStyle: 'solid',
        letterSpacing: 1,
        preset: 'elegant'
      }
    };

    const presetConfig = presets[preset] || presets.default;
    onChange({ ...customization, ...presetConfig });
  };

  return (
    <CustomizationContainer>
      <SectionTitle>🎨 Subtitle Customization</SectionTitle>

      {/* Presets Section */}
      <CollapsibleSection $expanded={expandedSections.presets}>
        <SectionHeader onClick={() => toggleSection('presets')}>
          <span>📋 Style Presets</span>
          <span>{expandedSections.presets ? '▼' : '▶'}</span>
        </SectionHeader>
        <SectionContent $expanded={expandedSections.presets}>
          <PresetGrid>
            {['default', 'modern', 'classic', 'neon', 'minimal', 'bold', 'elegant'].map(preset => (
              <PresetButton
                key={preset}
                $active={customization.preset === preset}
                onClick={() => applyPreset(preset as SubtitleCustomization['preset'])}
              >
                {preset.charAt(0).toUpperCase() + preset.slice(1)}
              </PresetButton>
            ))}
          </PresetGrid>
        </SectionContent>
      </CollapsibleSection>

      {/* Text Styling Section */}
      <CollapsibleSection $expanded={expandedSections.text}>
        <SectionHeader onClick={() => toggleSection('text')}>
          <span>✏️ Text Styling</span>
          <span>{expandedSections.text ? '▼' : '▶'}</span>
        </SectionHeader>
        <SectionContent $expanded={expandedSections.text}>
          <ControlRow>
            <ControlItem>
              <Label>Font Family</Label>
              <CustomDropdown
                value={customization.fontFamily}
                onChange={(value) => updateCustomization({ fontFamily: value })}
                options={[
                  { value: 'Inter', label: 'Inter' },
                  { value: 'Roboto', label: 'Roboto' },
                  { value: 'Arial', label: 'Arial' },
                  { value: 'Helvetica', label: 'Helvetica' },
                  { value: 'Times New Roman', label: 'Times New Roman' },
                  { value: 'Georgia', label: 'Georgia' },
                  { value: 'Impact', label: 'Impact' },
                  { value: 'Comic Sans MS', label: 'Comic Sans MS' },
                  { value: 'Courier New', label: 'Courier New' },
                  { value: 'Verdana', label: 'Verdana' }
                ]}
                placeholder="Select Font"
              />
            </ControlItem>
            <ControlItem>
              <Label>Font Size: {customization.fontSize}px</Label>
              <RangeInput
                type="range"
                min="12"
                max="72"
                value={customization.fontSize}
                onChange={(e) => updateCustomization({ fontSize: parseInt(e.target.value) })}
              />
            </ControlItem>
          </ControlRow>

          <ControlRow>
            <ControlItem>
              <Label>Font Weight: {customization.fontWeight}</Label>
              <RangeInput
                type="range"
                min="100"
                max="900"
                step="100"
                value={customization.fontWeight}
                onChange={(e) => updateCustomization({ fontWeight: parseInt(e.target.value) })}
              />
            </ControlItem>
            <ControlItem>
              <Label>Text Color</Label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <ColorInput
                  type="color"
                  value={customization.textColor}
                  onChange={(e) => updateCustomization({ textColor: e.target.value })}
                />
                <Input
                  type="text"
                  value={customization.textColor}
                  onChange={(e) => updateCustomization({ textColor: e.target.value })}
                  placeholder="#ffffff"
                />
              </div>
            </ControlItem>
          </ControlRow>

          <ControlRow>
            <ControlItem>
              <Label>Text Alignment</Label>
              <CustomDropdown
                value={customization.textAlign}
                onChange={(value) => updateCustomization({ textAlign: value as 'left' | 'center' | 'right' })}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' }
                ]}
                placeholder="Select Alignment"
              />
            </ControlItem>
            <ControlItem>
              <Label>Text Transform</Label>
              <CustomDropdown
                value={customization.textTransform}
                onChange={(value) => updateCustomization({ textTransform: value as any })}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'uppercase', label: 'UPPERCASE' },
                  { value: 'lowercase', label: 'lowercase' },
                  { value: 'capitalize', label: 'Capitalize' }
                ]}
                placeholder="Select Transform"
              />
            </ControlItem>
          </ControlRow>

          <ControlRow>
            <ControlItem>
              <Label>Line Height: {customization.lineHeight}</Label>
              <RangeInput
                type="range"
                min="0.8"
                max="2.0"
                step="0.1"
                value={customization.lineHeight}
                onChange={(e) => updateCustomization({ lineHeight: parseFloat(e.target.value) })}
              />
            </ControlItem>
            <ControlItem>
              <Label>Letter Spacing: {customization.letterSpacing}px</Label>
              <RangeInput
                type="range"
                min="-2"
                max="10"
                step="0.5"
                value={customization.letterSpacing}
                onChange={(e) => updateCustomization({ letterSpacing: parseFloat(e.target.value) })}
              />
            </ControlItem>
          </ControlRow>
        </SectionContent>
      </CollapsibleSection>

      {/* Background & Border Section */}
      <CollapsibleSection $expanded={expandedSections.background}>
        <SectionHeader onClick={() => toggleSection('background')}>
          <span>🎭 Background & Border</span>
          <span>{expandedSections.background ? '▼' : '▶'}</span>
        </SectionHeader>
        <SectionContent $expanded={expandedSections.background}>
          <ControlRow>
            <ControlItem>
              <Label>Background Color</Label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <ColorInput
                  type="color"
                  value={customization.backgroundColor}
                  onChange={(e) => updateCustomization({ backgroundColor: e.target.value })}
                />
                <Input
                  type="text"
                  value={customization.backgroundColor}
                  onChange={(e) => updateCustomization({ backgroundColor: e.target.value })}
                  placeholder="#000000"
                />
              </div>
            </ControlItem>
            <ControlItem>
              <Label>Background Opacity: {customization.backgroundOpacity}%</Label>
              <RangeInput
                type="range"
                min="0"
                max="100"
                value={customization.backgroundOpacity}
                onChange={(e) => updateCustomization({ backgroundOpacity: parseInt(e.target.value) })}
              />
            </ControlItem>
          </ControlRow>

          <ControlRow>
            <ControlItem>
              <Label>Border Radius: {customization.borderRadius}px</Label>
              <RangeInput
                type="range"
                min="0"
                max="50"
                value={customization.borderRadius}
                onChange={(e) => updateCustomization({ borderRadius: parseInt(e.target.value) })}
              />
            </ControlItem>
            <ControlItem>
              <Label>Border Width: {customization.borderWidth}px</Label>
              <RangeInput
                type="range"
                min="0"
                max="10"
                value={customization.borderWidth}
                onChange={(e) => updateCustomization({ borderWidth: parseInt(e.target.value) })}
              />
            </ControlItem>
          </ControlRow>

          <ControlRow>
            <ControlItem>
              <Label>Border Color</Label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <ColorInput
                  type="color"
                  value={customization.borderColor}
                  onChange={(e) => updateCustomization({ borderColor: e.target.value })}
                />
                <Input
                  type="text"
                  value={customization.borderColor}
                  onChange={(e) => updateCustomization({ borderColor: e.target.value })}
                  placeholder="#ffffff"
                />
              </div>
            </ControlItem>
            <ControlItem>
              <Label>Border Style</Label>
              <CustomDropdown
                value={customization.borderStyle}
                onChange={(value) => updateCustomization({ borderStyle: value as any })}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'solid', label: 'Solid' },
                  { value: 'dashed', label: 'Dashed' },
                  { value: 'dotted', label: 'Dotted' }
                ]}
                placeholder="Select Border Style"
              />
            </ControlItem>
          </ControlRow>
        </SectionContent>
      </CollapsibleSection>

      {/* Effects Section */}
      <CollapsibleSection $expanded={expandedSections.effects}>
        <SectionHeader onClick={() => toggleSection('effects')}>
          <span>✨ Effects & Shadows</span>
          <span>{expandedSections.effects ? '▼' : '▶'}</span>
        </SectionHeader>
        <SectionContent $expanded={expandedSections.effects}>
          <ControlRow>
            <ControlItem>
              <CheckboxContainer>
                <Checkbox
                  type="checkbox"
                  checked={customization.textShadowEnabled}
                  onChange={(e) => updateCustomization({ textShadowEnabled: e.target.checked })}
                />
                <Label>Enable Text Shadow</Label>
              </CheckboxContainer>
            </ControlItem>
            <ControlItem>
              <CheckboxContainer>
                <Checkbox
                  type="checkbox"
                  checked={customization.glowEnabled}
                  onChange={(e) => updateCustomization({ glowEnabled: e.target.checked })}
                />
                <Label>Enable Glow Effect</Label>
              </CheckboxContainer>
            </ControlItem>
          </ControlRow>

          {customization.textShadowEnabled && (
            <>
              <ControlRow>
                <ControlItem>
                  <Label>Shadow Color</Label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <ColorInput
                      type="color"
                      value={customization.textShadowColor}
                      onChange={(e) => updateCustomization({ textShadowColor: e.target.value })}
                    />
                    <Input
                      type="text"
                      value={customization.textShadowColor}
                      onChange={(e) => updateCustomization({ textShadowColor: e.target.value })}
                      placeholder="#000000"
                    />
                  </div>
                </ControlItem>
                <ControlItem>
                  <Label>Shadow Blur: {customization.textShadowBlur}px</Label>
                  <RangeInput
                    type="range"
                    min="0"
                    max="20"
                    value={customization.textShadowBlur}
                    onChange={(e) => updateCustomization({ textShadowBlur: parseInt(e.target.value) })}
                  />
                </ControlItem>
              </ControlRow>

              <ControlRow>
                <ControlItem>
                  <Label>Shadow Offset X: {customization.textShadowOffsetX}px</Label>
                  <RangeInput
                    type="range"
                    min="-10"
                    max="10"
                    value={customization.textShadowOffsetX}
                    onChange={(e) => updateCustomization({ textShadowOffsetX: parseInt(e.target.value) })}
                  />
                </ControlItem>
                <ControlItem>
                  <Label>Shadow Offset Y: {customization.textShadowOffsetY}px</Label>
                  <RangeInput
                    type="range"
                    min="-10"
                    max="10"
                    value={customization.textShadowOffsetY}
                    onChange={(e) => updateCustomization({ textShadowOffsetY: parseInt(e.target.value) })}
                  />
                </ControlItem>
              </ControlRow>
            </>
          )}

          {customization.glowEnabled && (
            <ControlRow>
              <ControlItem>
                <Label>Glow Color</Label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <ColorInput
                    type="color"
                    value={customization.glowColor}
                    onChange={(e) => updateCustomization({ glowColor: e.target.value })}
                  />
                  <Input
                    type="text"
                    value={customization.glowColor}
                    onChange={(e) => updateCustomization({ glowColor: e.target.value })}
                    placeholder="#ffffff"
                  />
                </div>
              </ControlItem>
              <ControlItem>
                <Label>Glow Intensity: {customization.glowIntensity}px</Label>
                <RangeInput
                  type="range"
                  min="0"
                  max="30"
                  value={customization.glowIntensity}
                  onChange={(e) => updateCustomization({ glowIntensity: parseInt(e.target.value) })}
                />
              </ControlItem>
            </ControlRow>
          )}
        </SectionContent>
      </CollapsibleSection>

      {/* Position Section */}
      <CollapsibleSection $expanded={expandedSections.position}>
        <SectionHeader onClick={() => toggleSection('position')}>
          <span>📍 Position & Layout</span>
          <span>{expandedSections.position ? '▼' : '▶'}</span>
        </SectionHeader>
        <SectionContent $expanded={expandedSections.position}>
          <ControlRow>
            <ControlItem>
              <Label>Position</Label>
              <CustomDropdown
                value={customization.position}
                onChange={(value) => updateCustomization({ position: value as any })}
                options={[
                  { value: 'bottom', label: 'Bottom' },
                  { value: 'top', label: 'Top' },
                  { value: 'center', label: 'Center' },
                  { value: 'custom', label: 'Custom' }
                ]}
                placeholder="Select Position"
              />
            </ControlItem>
            <ControlItem>
              <Label>Max Width: {customization.maxWidth}%</Label>
              <RangeInput
                type="range"
                min="20"
                max="100"
                value={customization.maxWidth}
                onChange={(e) => updateCustomization({ maxWidth: parseInt(e.target.value) })}
              />
            </ControlItem>
          </ControlRow>

          {customization.position === 'custom' && (
            <ControlRow>
              <ControlItem>
                <Label>Custom Position X: {customization.customPositionX}%</Label>
                <RangeInput
                  type="range"
                  min="0"
                  max="100"
                  value={customization.customPositionX}
                  onChange={(e) => updateCustomization({ customPositionX: parseInt(e.target.value) })}
                />
              </ControlItem>
              <ControlItem>
                <Label>Custom Position Y: {customization.customPositionY}%</Label>
                <RangeInput
                  type="range"
                  min="0"
                  max="100"
                  value={customization.customPositionY}
                  onChange={(e) => updateCustomization({ customPositionY: parseInt(e.target.value) })}
                />
              </ControlItem>
            </ControlRow>
          )}

          <ControlRow>
            <ControlItem>
              <Label>Margin Bottom: {customization.marginBottom}px</Label>
              <RangeInput
                type="range"
                min="0"
                max="200"
                value={customization.marginBottom}
                onChange={(e) => updateCustomization({ marginBottom: parseInt(e.target.value) })}
              />
            </ControlItem>
            <ControlItem>
              <Label>Margin Top: {customization.marginTop}px</Label>
              <RangeInput
                type="range"
                min="0"
                max="200"
                value={customization.marginTop}
                onChange={(e) => updateCustomization({ marginTop: parseInt(e.target.value) })}
              />
            </ControlItem>
          </ControlRow>

          <ControlRow>
            <ControlItem>
              <Label>Margin Left: {customization.marginLeft}px</Label>
              <RangeInput
                type="range"
                min="0"
                max="200"
                value={customization.marginLeft}
                onChange={(e) => updateCustomization({ marginLeft: parseInt(e.target.value) })}
              />
            </ControlItem>
            <ControlItem>
              <Label>Margin Right: {customization.marginRight}px</Label>
              <RangeInput
                type="range"
                min="0"
                max="200"
                value={customization.marginRight}
                onChange={(e) => updateCustomization({ marginRight: parseInt(e.target.value) })}
              />
            </ControlItem>
          </ControlRow>
        </SectionContent>
      </CollapsibleSection>

      {/* Animation Section */}
      <CollapsibleSection $expanded={expandedSections.animation}>
        <SectionHeader onClick={() => toggleSection('animation')}>
          <span>🎬 Animation & Timing</span>
          <span>{expandedSections.animation ? '▼' : '▶'}</span>
        </SectionHeader>
        <SectionContent $expanded={expandedSections.animation}>
          <ControlRow>
            <ControlItem>
              <Label>Animation Type</Label>
              <CustomDropdown
                value={customization.animationType}
                onChange={(value) => updateCustomization({ animationType: value as any })}
                options={[
                  { value: 'fade', label: 'Fade' },
                  { value: 'slide-up', label: 'Slide Up' },
                  { value: 'slide-down', label: 'Slide Down' },
                  { value: 'scale', label: 'Scale' },
                  { value: 'typewriter', label: 'Typewriter' }
                ]}
                placeholder="Select Animation"
              />
            </ControlItem>
            <ControlItem>
              <Label>Animation Easing</Label>
              <CustomDropdown
                value={customization.animationEasing}
                onChange={(value) => updateCustomization({ animationEasing: value as any })}
                options={[
                  { value: 'linear', label: 'Linear' },
                  { value: 'ease', label: 'Ease' },
                  { value: 'ease-in', label: 'Ease In' },
                  { value: 'ease-out', label: 'Ease Out' },
                  { value: 'ease-in-out', label: 'Ease In Out' }
                ]}
                placeholder="Select Easing"
              />
            </ControlItem>
          </ControlRow>

          <ControlRow>
            <ControlItem>
              <Label>Fade In Duration: {customization.fadeInDuration}s</Label>
              <RangeInput
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={customization.fadeInDuration}
                onChange={(e) => updateCustomization({ fadeInDuration: parseFloat(e.target.value) })}
              />
            </ControlItem>
            <ControlItem>
              <Label>Fade Out Duration: {customization.fadeOutDuration}s</Label>
              <RangeInput
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={customization.fadeOutDuration}
                onChange={(e) => updateCustomization({ fadeOutDuration: parseFloat(e.target.value) })}
              />
            </ControlItem>
          </ControlRow>
        </SectionContent>
      </CollapsibleSection>

      {/* Advanced Section */}
      <CollapsibleSection $expanded={expandedSections.advanced}>
        <SectionHeader onClick={() => toggleSection('advanced')}>
          <span>⚙️ Advanced Options</span>
          <span>{expandedSections.advanced ? '▼' : '▶'}</span>
        </SectionHeader>
        <SectionContent $expanded={expandedSections.advanced}>
          <ControlRow>
            <ControlItem>
              <CheckboxContainer>
                <Checkbox
                  type="checkbox"
                  checked={customization.wordWrap}
                  onChange={(e) => updateCustomization({ wordWrap: e.target.checked })}
                />
                <Label>Enable Word Wrap</Label>
              </CheckboxContainer>
            </ControlItem>
            <ControlItem>
              <CheckboxContainer>
                <Checkbox
                  type="checkbox"
                  checked={customization.rtlSupport}
                  onChange={(e) => updateCustomization({ rtlSupport: e.target.checked })}
                />
                <Label>RTL Support</Label>
              </CheckboxContainer>
            </ControlItem>
          </ControlRow>

          <ControlRow>
            <ControlItem>
              <Label>Max Lines: {customization.maxLines}</Label>
              <RangeInput
                type="range"
                min="1"
                max="10"
                value={customization.maxLines}
                onChange={(e) => updateCustomization({ maxLines: parseInt(e.target.value) })}
              />
            </ControlItem>
            <ControlItem>
              <Label>Line Break Behavior</Label>
              <CustomDropdown
                value={customization.lineBreakBehavior}
                onChange={(value) => updateCustomization({ lineBreakBehavior: value as any })}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'manual', label: 'Manual' }
                ]}
                placeholder="Select Behavior"
              />
            </ControlItem>
          </ControlRow>
        </SectionContent>
      </CollapsibleSection>
    </CustomizationContainer>
  );
};

export default SubtitleCustomizationPanel;
