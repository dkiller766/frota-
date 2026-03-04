import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCoords() {
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: "test_rls_1772624010827@example.com",
        password: "password123"
    });

    if (loginError) {
        console.error("Login Error:", loginError);
        return;
    }

    const { data: userProfile } = await supabase.from('profiles').select('*').eq('id', loginData.user.id).single();

    const { data: stations } = await supabase.from('fuel_stations').select('*').eq('company_id', userProfile.company_id).limit(10000);

    if (stations) {
        const withCoords = stations.filter(s => s.latitude !== null && s.longitude !== null);
        const withoutCoords = stations.filter(s => s.latitude === null || s.longitude === null);
        console.log(`Total: ${stations.length}`);
        console.log(`Com coords: ${withCoords.length}`);
        console.log(`Sem coords: ${withoutCoords.length}`);
        if (withoutCoords.length > 0) {
            console.log("Sample without coords:", withoutCoords.slice(0, 3));
        }
    }
}

checkCoords();
