import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const AUTH_KEY = 'bb-token';

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:5000/api`;
  }
  return 'http://127.0.0.1:5000/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
});

api.interceptors.request.use(
  async (config) => {
    try {
      let token: string | null = null;
      try {
        token = await SecureStore.getItemAsync(AUTH_KEY);
      } catch {}
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_KEY);
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('Error reading token from storage:', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
