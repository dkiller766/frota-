import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

let client = null;

if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://')) {
    try {
        client = createClient(supabaseUrl, supabaseAnonKey);
        console.log('Supabase inicializado com sucesso.');
    } catch (e) {
        console.error('Erro crítico ao inicializar o Supabase:', e);
    }
} else {
    console.error('Configurações do Supabase ausentes ou inválidas no .env. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
}

export const supabase = client;
