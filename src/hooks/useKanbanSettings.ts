import { useState, useEffect } from 'react';

export type ColumnWidth = 'narrow' | 'default' | 'wide';

interface KanbanSettings {
  columnWidth: ColumnWidth;
}

const STORAGE_KEY = 'kanban-settings';

const defaultSettings: KanbanSettings = {
  columnWidth: 'default',
};

export function useKanbanSettings() {
  const [settings, setSettings] = useState<KanbanSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...defaultSettings, ...JSON.parse(stored) };
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateColumnWidth = (width: ColumnWidth) => {
    setSettings((prev) => ({ ...prev, columnWidth: width }));
  };

  return {
    columnWidth: settings.columnWidth,
    updateColumnWidth,
  };
}

export const getColumnWidthClass = (width: ColumnWidth): string => {
  switch (width) {
    case 'narrow':
      return 'w-full sm:w-64';
    case 'default':
      return 'w-full sm:w-80';
    case 'wide':
      return 'w-full sm:w-96';
    default:
      return 'w-full sm:w-80';
  }
};
