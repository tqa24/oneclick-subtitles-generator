import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createGlobalStyle } from 'styled-components';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';

const GlobalStyle = createGlobalStyle`
  :root {
    /* Light theme variables */
    --light-background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    --light-card-background: #ffffff;
    --light-text-color: #333333;
    --light-border-color: #dddddd;
    --light-input-background: #ffffff;
    --light-hover-color: #f1f3f4;
    --light-accent-color: #2196f3;
    --light-error-color: #e53935;
    --light-success-color: #43a047;
    --light-info-color: #e3f2fd;
    --light-info-border: #2196f3;
    --light-code-background: #f5f5f5;
    --light-shadow-color: rgba(0, 0, 0, 0.1);
    --light-tab-background: #e8eaed;
    --light-active-tab: #ffffff;
  }

  /* Apply variables based on theme class */
  .light-theme {
    --background: var(--light-background);
    --card-background: var(--light-card-background);
    --text-color: var(--light-text-color);
    --border-color: var(--light-border-color);
    --input-background: var(--light-input-background);
    --hover-color: var(--light-hover-color);
    --accent-color: var(--light-accent-color);
    --error-color: var(--light-error-color);
    --success-color: var(--light-success-color);
    --info-color: var(--light-info-color);
    --info-border: var(--light-info-border);
    --code-background: var(--light-code-background);
    --shadow-color: var(--light-shadow-color);
    --tab-background: var(--light-tab-background);
    --active-tab: var(--light-active-tab);
  }

  .dark-theme {
    --background: linear-gradient(135deg, #2b2b2b 0%, #1a1a1a 100%);
    --card-background: #2d2d2d;
    --text-color: #e0e0e0;
    --border-color: #444444;
    --input-background: #3d3d3d;
    --hover-color: #383838;
    --accent-color: #64b5f6;
    --error-color: #f44336;
    --success-color: #66bb6a;
    --info-color: #1e3a5f;
    --info-border: #5c9ce6;
    --code-background: #2c2c2c;
    --shadow-color: rgba(0, 0, 0, 0.3);
    --tab-background: #383838;
    --active-tab: #444444;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: var(--background);
    color: var(--text-color);
    transition: background-color 0.3s ease;
  }

  input, select, button {
    font-family: inherit;
  }
`;

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <GlobalStyle />
        <App />
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
