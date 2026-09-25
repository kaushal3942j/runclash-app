const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jjkvuqcgpgpemgwtipbo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impqa3Z1cWNncGdwZW1nd3RpcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTE1ODUsImV4cCI6MjA5Nzc4NzU4NX0.SvkAAQsIlBq-1nPfx9zwgU-gXNHI6aFfKp6TLdIxcLE'
);

async function testSignup() {
  const email = `test+${Date.now()}@example.com`;
  console.log('Testing signup for:', email);
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'Password123!',
    options: {
      emailRedirectTo: 'https://runclash.vercel.app/',
      data: {
        display_name: 'Test Runner',
        clan_name: 'None'
      }
    }
  });

  if (error) {
    console.error('SIGNUP ERROR:');
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log('SIGNUP SUCCESS:');
    console.log(JSON.stringify(data, null, 2));
  }
}

testSignup();
