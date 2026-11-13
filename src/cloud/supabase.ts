// Cliente do Supabase (criado só quando a nuvem está configurada).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cloudEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!cloudEnabled) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // PKCE: o retorno do Google chega como ?code=..., sem conflitar com as rotas #nome
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'onze-br-lendario:auth',
      },
    });
  }
  return client;
}
