import React, { createContext, useContext, useState } from 'react';

const PrivateModeContext = createContext(null);

export function PrivateModeProvider({ children }) {
  const [privateMode, setPrivateMode] = useState(false);

  const togglePrivateMode = () => setPrivateMode((prev) => !prev);

  return (
    <PrivateModeContext.Provider value={{ privateMode, togglePrivateMode }}>
      {children}
    </PrivateModeContext.Provider>
  );
}

export function usePrivateMode() {
  const ctx = useContext(PrivateModeContext);
  if (!ctx) throw new Error('usePrivateMode must be used inside PrivateModeProvider');
  return ctx;
}
