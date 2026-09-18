import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://example.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function runSeedAndVerification() {
  console.log('Seeding Supabase database...');
  const now = new Date().toISOString();
  const DEFAULT_ORG_ID = 'org_meepro';

  // 1. Organization
  const { error: orgErr } = await supabase.from('organizations').upsert(
    {
      id: DEFAULT_ORG_ID,
      name: 'MeePro Mobile & Accessories',
      slug: 'meepro',
      created_at: now,
    },
    { onConflict: 'id' }
  );
  if (orgErr) throw orgErr;
  console.log('✓ Organization upserted');

  // 2. Staff Users
  const staff = [
    { id: 'user-admin', org_id: DEFAULT_ORG_ID, name: 'Somchai (Owner)', email: 'admin@meepro.store', role: 'admin', channel_access: 'all', working_hours: { enabled: true, start: '08:00', end: '20:00', days: [1,2,3,4,5,6] }, created_at: now },
    { id: 'user-sup', org_id: DEFAULT_ORG_ID, name: 'Ploy Support Lead', email: 'ploy@meepro.store', role: 'supervisor', channel_access: 'all', working_hours: { enabled: true, start: '09:00', end: '18:00', days: [1,2,3,4,5] }, created_at: now },
    { id: 'user-agent-1', org_id: DEFAULT_ORG_ID, name: 'Krit Sales Agent', email: 'krit@meepro.store', role: 'agent', channel_access: ['facebook', 'instagram'], working_hours: { enabled: true, start: '09:00', end: '18:00', days: [1,2,3,4,5] }, created_at: now },
    { id: 'user-agent-2', org_id: DEFAULT_ORG_ID, name: 'Nicha TikTok Agent', email: 'nicha@meepro.store', role: 'agent', channel_access: ['tiktok'], working_hours: { enabled: true, start: '10:00', end: '19:00', days: [2,3,4,5,6] }, created_at: now },
    { id: 'user-agent-3', org_id: DEFAULT_ORG_ID, name: 'Anan Support Agent', email: 'anan@meepro.store', role: 'agent', channel_access: ['facebook'], working_hours: { enabled: true, start: '12:00', end: '21:00', days: [1,2,3,4,5] }, created_at: now },
  ];
  const { error: userErr } = await supabase.from('users').upsert(staff, { onConflict: 'id' });
  if (userErr) throw userErr;
  console.log('✓ Staff users upserted (5 users)');

  // 3. Teams
  const teams = [
    { id: 'team-sales', org_id: DEFAULT_ORG_ID, name: 'Sales Team (ทีมขาย)', leader_id: 'user-admin', created_at: now },
    { id: 'team-support', org_id: DEFAULT_ORG_ID, name: 'Customer Support (บริการหลังการขาย)', leader_id: 'user-sup', created_at: now },
  ];
  const { error: teamErr } = await supabase.from('teams').upsert(teams, { onConflict: 'id' });
  if (teamErr) throw teamErr;
  console.log('✓ Teams upserted (2 teams)');

  // 4. Channel Connections
  const channels = [
    { id: 'conn-fb', org_id: DEFAULT_ORG_ID, channel: 'facebook', name: 'MeePro Official Facebook Page', account_id: 'meepro.official', status: 'active', credentials_encrypted: '', webhook_secret: '', created_at: now },
    { id: 'conn-ig', org_id: DEFAULT_ORG_ID, channel: 'instagram', name: 'MeePro Store IG', account_id: 'meepro_store', status: 'active', credentials_encrypted: '', webhook_secret: '', created_at: now },
    { id: 'conn-tiktok', org_id: DEFAULT_ORG_ID, channel: 'tiktok', name: 'MeePro TikTok Shop TH', account_id: 'meepro_tiktok_shop', status: 'active', credentials_encrypted: '', webhook_secret: '', created_at: now },
  ];
  const { error: connErr } = await supabase.from('channel_connections').upsert(channels, { onConflict: 'id' });
  if (connErr) throw connErr;
  console.log('✓ Channel connections upserted (3 channels)');

  // 5. Test Query verification
  const { data: convs, error: qErr } = await supabase.from('users').select('name, email, role');
  if (qErr) throw qErr;
  console.log('Verification query successful! Current staff in Supabase:');
  convs.forEach(u => console.log(` - ${u.name} (${u.role})`));

  console.log('\n--> SUCCESS: Supabase Database read/write verified 100%!');
}

runSeedAndVerification().catch(err => {
  console.error('Error during test:', err);
  process.exit(1);
});
