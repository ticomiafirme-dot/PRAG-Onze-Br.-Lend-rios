// Configuração da nuvem (Supabase). Os valores vêm das variáveis de ambiente
// do build (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY). A chave "anon" é
// pública por natureza: quem protege os dados são as políticas de segurança
// (RLS) do banco. Nunca coloque a chave service_role no frontend.
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

/** Login e nuvem disponíveis neste build? */
export const cloudEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
