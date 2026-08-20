import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  adminToken: string;
  setAdminToken: (token: string) => void;
  clearAdminToken: () => void;
  hasAdminToken: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [adminToken, setAdminTokenState] = useState<string>(() => {
    return localStorage.getItem('aims_admin_token') || '';
  });

  const setAdminToken = (token: string) => {
    setAdminTokenState(token.trim());
    if (token.trim()) {
      localStorage.setItem('aims_admin_token', token.trim());
    } else {
      localStorage.removeItem('aims_admin_token');
    }
  };

  const clearAdminToken = () => {
    setAdminTokenState('');
    localStorage.removeItem('aims_admin_token');
  };

  return (
    <AuthContext.Provider
      value={{
        adminToken,
        setAdminToken,
        clearAdminToken,
        hasAdminToken: Boolean(adminToken.trim()),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
