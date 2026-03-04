import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRLS() {
    // To check if RLS is enabled, we'd normally query pg_class. Since we don't have access,
    // let's just insert a station without standard user (anon) to see if we get an RLS error.

    const { data: insertAnon, error: AnonErr } = await supabase
        .from('fuel_stations')
        .insert([{
            name: 'Anon Station',
            address: 'Anon Address',
            company_id: '00000000-0000-0000-0000-000000000000'
        }]);

    console.log("Insert Anon:", AnonErr ? AnonErr.message : "Success (RLS off for insert?)");

    const { data: selectAnon, error: selErr } = await supabase
        .from('fuel_stations')
        .select('*');

    console.log("Select Anon:", selErr ? selErr.message : `Success: got ${selectAnon.length} rows`);
}

checkRLS();
