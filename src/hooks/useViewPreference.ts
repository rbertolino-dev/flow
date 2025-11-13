import { useState, useEffect } from 'react';

export type ViewMode = 'kanban' | 'list' | 'calendar';

const STORAGE_KEY = 'sales-funnel-view-mode';

export function useViewPreference() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'list' || stored === 'calendar' ? stored : 'kanban') as ViewMode;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  const toggleView = () => {
    setViewMode(prev => {
      if (prev === 'kanban') return 'list';
      if (prev === 'list') return 'calendar';
      return 'kanban';
    });
  };

  return {
    viewMode,
    setViewMode,
    toggleView,
  };
}
