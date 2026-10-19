import React, { createContext, useState, useEffect, useCallback } from 'react';
import api, { errorMessage } from '../api/client';

export const AuthContext = createContext();

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('userInfo')) || null;
  } catch {
    return null;
  }
};

const storeUser = (user) => {
  try {
    if (user) localStorage.setItem('userInfo', JSON.stringify(user));
    else localStorage.removeItem('userInfo');
  } catch {
    // Storage unavailable: the session just won't survive a reload
  }
};

export const AuthProvider = ({ children }) => {
  // Read synchronously so signed-in pages don't flash a logged-out state
  const [user, setUser] = useState(readStoredUser);
  const loading = false;

  const logout = useCallback(() => {
    setUser(null);
    storeUser(null);
  }, []);

  // Sign out when the API reports the session is no longer valid
  useEffect(() => {
    window.addEventListener('auth:expired', logout);
    return () => window.removeEventListener('auth:expired', logout);
  }, [logout]);

  // Refresh profile details (avatar, shelves) saved from an earlier visit
  useEffect(() => {
    if (!readStoredUser()) return;
    api.get('/api/auth/profile')
      .then(({ data }) => {
        setUser(prev => {
          if (!prev) return prev;
          const next = { ...prev, ...data };
          storeUser(next);
          return next;
        });
      })
      .catch(() => {
        // 401s are handled by the auth:expired event; ignore network errors
      });
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      setUser(data);
      storeUser(data);
      return data;
    } catch (error) {
      throw new Error(errorMessage(error, 'Login failed'));
    }
  };

  const register = async (name, email, password) => {
    try {
      const { data } = await api.post('/api/auth/register', { name, email, password });
      setUser(data);
      storeUser(data);
      return data;
    } catch (error) {
      throw new Error(errorMessage(error, 'Registration failed'));
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    storeUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
