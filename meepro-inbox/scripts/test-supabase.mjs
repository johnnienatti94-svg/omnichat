import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://example.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function checkTable() {
  const { data, error, status } = await supabase.from('organizations').select('*');
  console.log('Status:', status);
  console.log('Data:', data);
  console.log('Error:', error);
}

checkTable();
