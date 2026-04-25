// client/src/context/SearchContext.tsx
import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

type SearchContextType = {
  open: boolean;
  initialQuery: string;
  openSearch: (query?: string) => void;
  closeSearch: () => void;
};

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');

  const openSearch = (query?: string) => {
    setInitialQuery((query || '').trim());
    setOpen(true);
  };

  const closeSearch = () => setOpen(false);

  const value = useMemo(
    () => ({ open, initialQuery, openSearch, closeSearch }),
    [open, initialQuery]
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
};

export const useSearchUI = (): SearchContextType => {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearchUI must be used within SearchProvider');
  return ctx;
};