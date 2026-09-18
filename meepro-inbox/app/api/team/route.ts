import { db, identity, result, logAudit, DEFAULT_ORG_ID } from '@/lib/inbox-server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getTeamsAndUsers, getAuditLogs } from '@/lib/db/supabase-repository';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

const teamSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  leader_id: z.string().default(''),
});

export async function GET(req: Request) {
  const owner = identity(req);
  if (!owner) return result({ error: 'Unauthorized' }, 401);

  try {
    if (isSupabaseConfigured()) {
      const { teams } = await getTeamsAndUsers(DEFAULT_ORG_ID);
      const logs = await getAuditLogs(DEFAULT_ORG_ID, 50);
      return result({ teams, logs });
    }

    const d = db();
    const [teamsRes, logsRes] = await Promise.all([
      d.prepare('SELECT id, org_id, name, leader_id, created_at FROM teams WHERE org_id = ? ORDER BY created_at ASC').bind(DEFAULT_ORG_ID).all(),
      d.prepare('SELECT id, org_id, user_id, action, target_type, target_id, details, created_at FROM audit_logs WHERE org_id = ? ORDER BY created_at DESC LIMIT 50').bind(DEFAULT_ORG_ID).all(),
    ]);

    return result({
      teams: teamsRes.results,
      logs: logsRes.results,
    });
  } catch (err) {
    console.error('Failed to get teams/logs:', err);
    return result({ error: 'Could not fetch team information' }, 500);
  }
}

export async function POST(req: Request) {
  const owner = identity(req);
  if (!owner) return result({ error: 'Unauthorized' }, 401);

  try {
    const body = await req.json();
    const parsed = teamSchema.safeParse(body);
    if (!parsed.success) {
      return result({ error: 'Invalid team data', details: parsed.error.issues }, 400);
    }

    const { id, name, leader_id } = parsed.data;
    const teamId = id || `team-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const isNew = !id;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      await supabase.from('teams').upsert(
        { id: teamId, org_id: DEFAULT_ORG_ID, name, leader_id: leader_id || null, created_at: now },
        { onConflict: 'id' }
      );
      await logAudit(DEFAULT_ORG_ID, owner, isNew ? 'created_team' : 'updated_team', 'team', teamId, { name, leader_id });
      return result({ ok: true, teamId });
    }

    const d = db();
    if (isNew) {
      await d
        .prepare('INSERT INTO teams (id, org_id, name, leader_id, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(teamId, DEFAULT_ORG_ID, name, leader_id, now)
        .run();

      await logAudit(DEFAULT_ORG_ID, owner, 'created_team', 'team', teamId, { name, leader_id });
    } else {
      await d
        .prepare('UPDATE teams SET name = ?, leader_id = ? WHERE id = ? AND org_id = ?')
        .bind(name, leader_id, teamId, DEFAULT_ORG_ID)
        .run();

      await logAudit(DEFAULT_ORG_ID, owner, 'updated_team', 'team', teamId, { name, leader_id });
    }

    return result({ ok: true, teamId });
  } catch (err) {
    console.error('Failed to save team:', err);
    return result({ error: 'Could not save team' }, 500);
  }
}
