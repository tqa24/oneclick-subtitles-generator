import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import styled, { ThemeProvider, createGlobalStyle } from 'styled-components';
import UploadForm from './components/UploadForm/UploadForm.component';
import QueueManager from './components/QueueManager';
import { LyricEntry } from './types';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ThemeProvider as CustomThemeProvider, useTheme, ThemeConsumer, lightTheme, darkTheme } from './contexts/ThemeContext';
import { QueueProvider } from './contexts/QueueContext';
import { TabsProvider, useTabs } from './contexts/TabsContext';
import TabBar from './components/TabBar';
import Workspace from './components/Workspace';
import ThemeLanguageSwitcher from './components/ThemeLanguageSwitcher';
import { v4 as uuidv4 } from 'uuid';

// Get server URL from environment or default to port 3020
const SERVER_URL = process.env.REACT_APP_API_URL || 'http://localhost:3020';

// Create our Header component
const Header: React.FC = () => {
  const { t } = useLanguage();
  
  const handleClearCache = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/clear-cache`, {
        method: 'POST'
      });
      
      if (response.ok) {
        alert('Cache cleared successfully');
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Failed to clear cache');
    }
  };

  return (
    <HeaderContainer>
      <Logo>
        <MusicIcon />
        <h1>{t('appTitle')}</h1>
      </Logo>
      <Controls>
        <ControlButton onClick={handleClearCache} title="Clear uploaded files cache">
          <DeleteIcon />
          {t('clearCache')}
        </ControlButton>
        <ThemeLanguageSwitcher />
      </Controls>
    </HeaderContainer>
  );
};

const ControlButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--header-text);
  padding: 0.5rem 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 6px;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
  height: 2.25rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  svg {
    width: 18px;
    height: 18px;
  }
`;

const DeleteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"></path>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
  </svg>
);

// Icon components
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

const MusicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13"></path>
    <circle cx="6" cy="18" r="3"></circle>
    <circle cx="18" cy="16" r="3"></circle>
  </svg>
);

// App content component with improved layout
const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const { activeWorkspace } = useTabs();
  
  return (
    <PageContainer>
      <Header />
      <TabBar />
      <TwoColumnLayout>
        <WorkspaceColumn>
          {activeWorkspace && (
            <Workspace tabId={activeWorkspace.id} />
          )}
        </WorkspaceColumn>
        <QueueColumn>
          <QueueContainer>
            <QueueTitle>{t('renderQueue')}</QueueTitle>
            <QueueManager />
          </QueueContainer>
        </QueueColumn>
      </TwoColumnLayout>
      <Footer>
        <p>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
          © {new Date().getFullYear()} Lyrics Video Maker
        </p>
        <p>Version 1.0.0</p>
      </Footer>
    </PageContainer>
  );
};

// Main App component
function App() {
  return (
    <Router>
      <CustomThemeProvider>
        <ThemeConsumer>
          {(themeContext) => themeContext && (
            <ThemeProvider theme={themeContext.theme === 'dark' ? darkTheme : lightTheme}>
              <LanguageProvider>
                <QueueProvider>
                  <TabsProvider>
                    <GlobalStyle />
                    <Routes>
                      <Route path="/" element={<AppContent />} />
                    </Routes>
                  </TabsProvider>
                </QueueProvider>
              </LanguageProvider>
            </ThemeProvider>
          )}
        </ThemeConsumer>
      </CustomThemeProvider>
    </Router>
  );
}

// Styled components
const HeaderContainer = styled.header`
  background: linear-gradient(135deg, var(--header-gradient-start), var(--header-gradient-end));
  color: var(--header-text);
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: all 0.3s ease;
  
  @media (max-width: 768px) {
    padding: 1rem;
    flex-direction: column;
    align-items: flex-start;
  }
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  
  h1 {
    font-size: 1.5rem;
    margin: 0;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--header-text);
    
    @media (max-width: 768px) {
      font-size: 1.3rem;
    }
  }
  
  svg {
    margin-right: 0.75rem;
    font-size: 1.75rem;
  }
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  
  @media (max-width: 768px) {
    margin-top: 1rem;
    width: 100%;
    justify-content: flex-end;
  }
`;

const TwoColumnLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 450px;
  gap: 2rem;
  max-width: 1600px;
  margin: 0 auto;
  padding: 1.5rem;
  width: 100%;
  
  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const WorkspaceColumn = styled.div`
  min-width: 0; /* Allows content to shrink below min-content width */
`;

const QueueColumn = styled.div`
  @media (max-width: 1200px) {
    grid-row: 1;
  }
`;

const QueueContainer = styled.div`
  background: var(--card-background);
  border-radius: 8px;
  box-shadow: 0 4px 6px var(--shadow-color);
  padding: 1.5rem;
  position: sticky;
  top: 80px;
  max-height: calc(100vh - 180px);
  overflow-y: auto;
  transition: background-color 0.3s, box-shadow 0.3s;
  
  @media (max-width: 1200px) {
    position: static;
    max-height: none;
  }
`;

const QueueTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 1rem;
  color: var(--heading-color);
  font-size: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
`;

const GlobalStyle = createGlobalStyle`
  :root {
    --accent-color: #3f51b5;
    --accent-color-secondary: #7986cb;
    --accent-color-rgb: 63, 81, 181;
    --border-color: rgba(0, 0, 0, 0.1);
    --hover-color: rgba(0, 0, 0, 0.03);
    --hover-color-darker: rgba(0, 0, 0, 0.08);
    --disabled-color: #cccccc;
    --info-background: rgba(25, 118, 210, 0.05);
    --error-color: #f44336;
    --error-background: rgba(244, 67, 54, 0.08);
    --code-background: #2d2d2d;
    --code-text-color: #f8f8f2;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: var(--background-color);
    color: var(--text-color);
    transition: all 0.3s ease;
  }

  h1, h2, h3, h4, h5, h6 {
    margin-top: 0;
    color: var(--heading-color);
  }

  a {
    color: var(--accent-color);
    text-decoration: none;
    transition: color 0.2s ease;
    
    &:hover {
      color: var(--accent-color-secondary);
    }
  }

  button, input, select, textarea {
    font-family: inherit;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }
  
  ::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }
`;

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--background-color);
  color: var(--text-color);
  transition: background-color 0.3s ease;
`;

const Footer = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 2rem;
  background-color: var(--card-background);
  color: var(--footer-text);
  font-size: 0.85rem;
  border-top: 1px solid var(--border-color);
  margin-top: auto;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
    padding: 0.75rem 1rem;
  }

  p {
    margin: 0;
    opacity: 0.8;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`;

export default App;
