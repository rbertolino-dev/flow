import { useState, useEffect } from 'react';

export type ViewMode = 'kanban' | 'list' | 'calendar';
export type CardSize = 'normal' | 'compact';

const VIEW_MODE_STORAGE_KEY = 'sales-funnel-view-mode';
const CARD_SIZE_STORAGE_KEY = 'sales-funnel-card-size';

export function useViewPreference() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return (stored === 'list' || stored === 'calendar' ? stored : 'kanban') as ViewMode;
  });

  const [cardSize, setCardSize] = useState<CardSize>(() => {
    const stored = localStorage.getItem(CARD_SIZE_STORAGE_KEY);
    return (stored === 'compact' ? 'compact' : 'normal') as CardSize;
  });

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(CARD_SIZE_STORAGE_KEY, cardSize);
  }, [cardSize]);

  const toggleView = () => {
    setViewMode(prev => {
      if (prev === 'kanban') return 'list';
      if (prev === 'list') return 'calendar';
      return 'kanban';
    });
  };

  const toggleCardSize = () => {
    setCardSize(prev => prev === 'normal' ? 'compact' : 'normal');
  };

  return {
    viewMode,
    setViewMode,
    toggleView,
    cardSize,
    setCardSize,
    toggleCardSize,
  };
}
