import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("No credentials found");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log("Signing in anonymously...");
  const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
  if (authErr) {
    console.error("Auth Error:", authErr.message);
    return;
  }
  
  const userId = authData.user.id;
  console.log("User ID:", userId);

  console.log("Updating profile...");
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: 'Test Name' })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error("Update Error:", error);
    } else {
      console.log("Update Success:", data);
    }
  } catch (err) {
    console.error("Update Exception:", err);
  }
}

run();
