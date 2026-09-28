import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjkvuqcgpgpemgwtipbo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impqa3Z1cWNncGdwZW1nd3RpcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTE1ODUsImV4cCI6MjA5Nzc4NzU4NX0.SvkAAQsIlBq-1nPfx9zwgU-gXNHI6aFfKp6TLdIxcLE'
);

async function checkTables() {
  const tables = ['clan_members', 'clan_join_requests', 'social_posts', 'post_likes', 'post_comments'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table ${table} error:`, error.message);
    } else {
      console.log(`Table ${table} exists.`);
    }
  }
}
checkTables();
