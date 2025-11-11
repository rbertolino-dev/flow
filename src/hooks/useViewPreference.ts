import { useState, useEffect } from 'react';

export type ViewMode = 'kanban' | 'list';

const STORAGE_KEY = 'sales-funnel-view-mode';

export function useViewPreference() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'list' ? 'list' : 'kanban') as ViewMode;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  const toggleView = () => {
    setViewMode(prev => prev === 'kanban' ? 'list' : 'kanban');
  };

  return {
    viewMode,
    setViewMode,
    toggleView,
  };
}
