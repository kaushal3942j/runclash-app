import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjkvuqcgpgpemgwtipbo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impqa3Z1cWNncGdwZW1nd3RpcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTE1ODUsImV4cCI6MjA5Nzc4NzU4NX0.SvkAAQsIlBq-1nPfx9zwgU-gXNHI6aFfKp6TLdIxcLE'
);

async function checkSchema() {
  console.log("Checking clans table...");
  const { data, error } = await supabase.from('clans').select('*').limit(1);
  if (error) {
    console.error("Error querying clans:", error.message);
  } else {
    console.log("Query successful. Data:", data);
    if (data && data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    } else {
      console.log("Table is empty, but query succeeded. Let's try inserting a dummy record to see schema error.");
      const { error: insertError } = await supabase.from('clans').insert({
        name: 'TestSchemaClan',
        description: 'Testing schema',
      });
      if (insertError) {
        console.error("Insert error:", insertError.message);
      } else {
        console.log("Insert succeeded?! The description column MUST exist and be known to PostgREST.");
      }
    }
  }
}

checkSchema();
