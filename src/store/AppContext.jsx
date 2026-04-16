import { createContext, useContext, useState, useCallback } from 'react';
import { loadDb, saveDb } from './db';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try { const s = sessionStorage.getItem('360_user'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  // Lightweight trigger for re-renders after db mutations
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  const login = useCallback((user) => {
    setCurrentUser(user);
    sessionStorage.setItem('360_user', JSON.stringify(user));
    setTick(t => t + 1);
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem('360_user');
  }, []);

  return (
    <AppContext.Provider value={{ currentUser, login, logout, refresh, tick }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
};
