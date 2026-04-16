import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { initDb } from '../lib/supabase';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try { const s = sessionStorage.getItem('360_user'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [dbReady, setDbReady] = useState(false);
  const [tick, setTick] = useState(0);

  // Initialize Supabase on app start (create tables/seed if needed)
  useEffect(() => {
    initDb()
      .then(() => setDbReady(true))
      .catch(err => {
        console.warn('DB init warning:', err);
        setDbReady(true); // Allow app to run even if seed fails
      });
  }, []);

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
    <AppContext.Provider value={{ currentUser, login, logout, refresh, tick, dbReady }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
};
