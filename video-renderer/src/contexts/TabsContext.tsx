import React, { createContext, useState, useContext, ReactNode } from 'react';
import { LyricEntry, VideoMetadata, AudioFiles } from '../types';

// Define the structure of a workspace tab
export interface WorkspaceTab {
  id: string;
  name: string;
  $active: boolean;  // Change active to $active
  audioFiles: AudioFiles;
  subtitles: LyricEntry[] | null; // Renamed from lyrics
  subtitlesFile: File | null;  // Renamed from lyricsFile
  metadata: VideoMetadata;
  durationInSeconds: number;
  videoPath: string;
}

// Function to load user preferences from localStorage
function loadUserPreferences() {
  try {
    // Load resolution preference
    const savedResolution = localStorage.getItem('preferredResolution');
    const validResolutions = ['480p', '720p', '1080p', '2K'];
    const resolution = validResolutions.includes(savedResolution || '') ? savedResolution : '2K';

    // Load frame rate preference
    const savedFrameRate = localStorage.getItem('preferredFrameRate');
    const frameRate = savedFrameRate === '30' ? 30 : 60;

    return { resolution, frameRate };
  } catch (error) {
    console.error('Error loading preferences from localStorage:', error);
    return { resolution: '2K' as const, frameRate: 60 as const };
  }
}

// Create a default empty workspace
export function createEmptyWorkspace(id: string, name: string): WorkspaceTab {
  // Load user preferences
  const { resolution, frameRate } = loadUserPreferences();

  return {
  id,
  name,
  $active: false,  // Change active to $active
  audioFiles: {
    main: null,
    narration: null
  },
  subtitles: null,
  subtitlesFile: null,
  metadata: {
    videoType: 'Subtitled Video',
    resolution: resolution as '480p' | '720p' | '1080p' | '2K',
    frameRate: frameRate as 30 | 60,
    originalAudioVolume: 100,
    narrationVolume: 100
  },
  durationInSeconds: 0,
  videoPath: ''
  };
}

interface TabsContextType {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  addTab: (name?: string) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  updateTabContent: (id: string, updates: Partial<WorkspaceTab>) => void;
  activeWorkspace: WorkspaceTab | null;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export const TabsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([
    // Start with one empty workspace
    { ...createEmptyWorkspace('tab-1', 'New Video 1'), $active: true }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');

  // Get current active workspace
  const activeWorkspace = tabs.find(tab => tab.id === activeTabId) || null;

  // Add a new tab
  const addTab = (name?: string) => {
    const newId = `tab-${tabs.length + 1}`;
    const newTabName = name || `New Video ${tabs.length + 1}`;

    // Deactivate all existing tabs
    const updatedTabs = tabs.map(tab => ({
      ...tab,
      $active: false
    }));

    // Add the new tab
    setTabs([
      ...updatedTabs,
      { ...createEmptyWorkspace(newId, newTabName), $active: true }
    ]);

    // Set the new tab as active
    setActiveTabId(newId);
  };

  // Close a tab
  const closeTab = (id: string) => {
    // If we're closing the active tab, we need to activate another one
    if (id === activeTabId) {
      const currentIndex = tabs.findIndex(tab => tab.id === id);
      let newActiveIndex = currentIndex - 1;

      // If we're closing the first tab, activate the next one
      if (newActiveIndex < 0 && tabs.length > 1) {
        newActiveIndex = 0;
      }

      // If there are other tabs, activate one
      if (newActiveIndex >= 0) {
        const newActiveId = tabs[newActiveIndex].id;
        setActiveTabId(newActiveId);

        // Update tabs, deactivating all and activating the new one
        setTabs(prevTabs =>
          prevTabs
            .filter(tab => tab.id !== id)
            .map(tab => ({
              ...tab,
              $active: tab.id === newActiveId
            }))
        );
      } else {
        // We're closing the last tab, create a new empty one
        const newId = `tab-${Date.now()}`;
        setTabs([{ ...createEmptyWorkspace(newId, 'New Video 1'), $active: true }]);
        setActiveTabId(newId);
      }
    } else {
      // Just remove the tab
      setTabs(prevTabs => prevTabs.filter(tab => tab.id !== id));
    }
  };

  // Activate a tab
  const activateTab = (id: string) => {
    setActiveTabId(id);

    // Update all tabs' active state
    setTabs(prevTabs =>
      prevTabs.map(tab => ({
        ...tab,
        $active: tab.id === id
      }))
    );
  };

  // Update a tab's content
  const updateTabContent = (id: string, updates: Partial<WorkspaceTab>) => {
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === id ? { ...tab, ...updates } : tab
      )
    );
  };

  return (
    <TabsContext.Provider value={{
      tabs,
      activeTabId,
      addTab,
      closeTab,
      activateTab,
      updateTabContent,
      activeWorkspace
    }}>
      {children}
    </TabsContext.Provider>
  );
};

export const useTabs = (): TabsContextType => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('useTabs must be used within a TabsProvider');
  }
  return context;
};