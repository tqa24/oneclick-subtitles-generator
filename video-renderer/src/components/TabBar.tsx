import React from 'react';
import styled from 'styled-components';
import { useTabs } from '../contexts/TabsContext';
import { useLanguage } from '../contexts/LanguageContext';

const TabBar: React.FC = () => {
  const { tabs, activeTabId, addTab, closeTab, activateTab } = useTabs();
  const { t } = useLanguage();

  return (
    <TabBarContainer>
      <TabsWrapper>
        {tabs.map(tab => (
          <TabItem 
            key={tab.id} 
            $active={tab.id === activeTabId}
            onClick={() => activateTab(tab.id)}
          >
            <TabTitle>{tab.name}</TabTitle>
            <CloseButton onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}>
              &times;
            </CloseButton>
          </TabItem>
        ))}
      </TabsWrapper>
      <AddTabButton onClick={() => addTab()}>+</AddTabButton>
    </TabBarContainer>
  );
};

const TabBarContainer = styled.div`
  display: flex;
  align-items: center;
  background-color: var(--tab-background);
  border-bottom: 1px solid var(--border-color);
  height: 48px;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  transition: all 0.3s ease;
  padding: 0 8px;
  position: sticky;
  top: 0;
  z-index: 90;
  backdrop-filter: blur(8px);
  
  &::-webkit-scrollbar {
    display: none;
  }
`;

const TabsWrapper = styled.div`
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 2px;
  padding: 6px 0;
  
  &::-webkit-scrollbar {
    display: none;
  }
`;

const TabItem = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  min-width: 160px;
  max-width: 240px;
  height: 36px;
  padding: 0 16px;
  background-color: ${props => props.$active ? 'var(--active-tab)' : 'var(--tab-background)'};
  border-radius: 8px;
  margin: 0 1px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: ${props => props.$active ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none'};
  
  &:hover {
    background-color: ${props => props.$active ? 'var(--active-tab)' : 'var(--hover-color)'};
    transform: translateY(-1px);
  }
  
  &::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: ${props => props.$active ? 'linear-gradient(90deg, var(--accent-color), var(--accent-color-secondary))' : 'transparent'};
    border-radius: 2px;
    transition: all 0.3s ease;
  }
`;

const TabTitle = styled.div`
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-color);
  margin-right: 8px;
  transition: all 0.3s ease;
  opacity: 0.9;
  
  ${TabItem}:hover & {
    opacity: 1;
  }
`;

const CloseButton = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  color: var(--text-color);
  opacity: 0.6;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: transparent;
  
  &:hover {
    background-color: var(--hover-color);
    opacity: 1;
    transform: scale(1.1);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const AddTabButton = styled.div`
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent-color), var(--accent-color-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  color: white;
  cursor: pointer;
  margin: 0 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  
  &:hover {
    transform: translateY(-1px) scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  &:active {
    transform: translateY(0) scale(0.98);
  }
`;

export default TabBar;