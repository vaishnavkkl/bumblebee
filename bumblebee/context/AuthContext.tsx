import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
import { useRouter, useSegments } from 'expo-router';

export interface User {
  id: number;
  name: string;
  phone: string;
  role: 'admin' | 'employee';
  salary: number;
  is_active: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AUTH_KEY = 'bb-token';

async function getStoredToken() {
  try {
    const token = await SecureStore.getItemAsync(AUTH_KEY);
    if (token) return token;
  } catch { }
  return AsyncStorage.getItem(AUTH_KEY);
}

async function setStoredToken(token: string) {
  try {
    await SecureStore.setItemAsync(AUTH_KEY, token);
  } catch {
    await AsyncStorage.setItem(AUTH_KEY, token);
  }
}

async function deleteStoredToken() {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(AUTH_KEY),
    AsyncStorage.removeItem(AUTH_KEY),
  ]);
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function loadStorageData() {
      try {
        const storedToken = await getStoredToken();
        if (storedToken) {
          setToken(storedToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          const res = await api.get('/auth/me');
          setUser(res.data);
        }
      } catch (e) {
        console.warn('Failed to restore auth token:', e);
        await deleteStoredToken();
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadStorageData();
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      router.replace('/(tabs)');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  const login = async (phone: string, password: string) => {
    const res = await api.post('/auth/login', { phone, password });
    const { token: t, user: u } = res.data;

    await setStoredToken(t);
    setToken(t);
    setUser(u);
    api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    return u;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) { }
    await deleteStoredToken();
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
