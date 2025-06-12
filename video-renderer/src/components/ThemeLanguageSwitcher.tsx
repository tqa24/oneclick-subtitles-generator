import React from 'react';
import styled from 'styled-components';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage, Language } from '../contexts/LanguageContext';

const ThemeToggle = styled.button<{ $isDark: boolean }>`
  position: relative;
  width: 64px;
  height: 32px;
  border-radius: 16px;
  background: ${props => props.$isDark ? 
    'linear-gradient(to bottom, #28316C, #1a1f42)' : 
    'linear-gradient(to bottom, #80B6F9, #6E9EE7)'};
  border: none;
  cursor: pointer;
  padding: 2px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const ToggleThumb = styled.div<{ $isDark: boolean }>`
  position: absolute;
  top: 2px;
  left: ${props => props.$isDark ? '34px' : '2px'};
  width: 28px;
  height: 28px;
  background: ${props => props.$isDark ? 
    'linear-gradient(135deg, #ECF3FF, #FFFFFF)' : 
    'linear-gradient(135deg, #FDB813, #F89B1C)'};
  border-radius: 50%;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    width: 16px;
    height: 16px;
    color: ${props => props.$isDark ? '#1a1f42' : '#fff'};
    stroke-width: 2.5;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
  }
`;

const SwitcherContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin: 0 0.5rem;
  
  @media (max-width: 768px) {
    gap: 1rem;
    flex-direction: column;
    align-items: stretch;
  }
`;

const SwitcherGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.875rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.375rem 0.75rem;
  border-radius: 8px;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  height: 2.25rem;
  
  @media (max-width: 768px) {
    justify-content: space-between;
  }
`;

const SwitcherLabel = styled.span`
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--header-text);
  user-select: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
`;

const LanguageSelect = styled.select`
  padding: 0.375rem 2rem 0.375rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--header-text);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.7rem center;
  background-size: 1em;
  backdrop-filter: blur(8px);
  height: 2.25rem;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
  }
  
  &:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
  }
  
  option {
    background: var(--dropdown-background);
    color: var(--text-color);
    padding: 8px;
  }
`;

// SVG icons
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 3v2m0 14v2M5.2 5.2l1.4 1.4m10.8 10.8l1.4 1.4M3 12h2m14 0h2M5.2 18.8l1.4-1.4m10.8-10.8l1.4-1.4"/>
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>
  </svg>
);

// Update the ThemeLanguageSwitcher component to use new icons
const ThemeLanguageSwitcher: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const isDark = theme === 'dark';

  return (
    <SwitcherContainer>
      <SwitcherGroup>
        <SwitcherLabel>{t('theme')}:</SwitcherLabel>
        <ThemeToggle onClick={toggleTheme} $isDark={isDark}>
          <ToggleThumb $isDark={isDark}>
            {isDark ? <MoonIcon /> : <SunIcon />}
          </ToggleThumb>
        </ThemeToggle>
      </SwitcherGroup>

      <SwitcherGroup>
        <SwitcherLabel>{t('language')}:</SwitcherLabel>
        <LanguageSelect 
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
        >
          <option value="en">{t('english')}</option>
          <option value="ko">{t('korean')}</option>
          <option value="vi">{t('vietnamese')}</option>
        </LanguageSelect>
      </SwitcherGroup>
    </SwitcherContainer>
  );
};

export default ThemeLanguageSwitcher;