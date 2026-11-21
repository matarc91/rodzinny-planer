// Klient kompatybilności – przekierowuje wywołania z dawnego Supabase na własny apiClient (serwer cosmere)
import { apiClient } from './api.js';

export const isSupabaseConfigured = true;

export const getSupabaseClient = () => {
  return apiClient;
};

export default getSupabaseClient;
