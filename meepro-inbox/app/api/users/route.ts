import { db, identity, result, logAudit, DEFAULT_ORG_ID } from '@/lib/inbox-server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getTeamsAndUsers } from '@/lib/db/supabase-repository';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  role: z.enum(['admin', 'supervisor', 'agent']),
  channel_access: z.union([z.literal('all'), z.array(z.enum(['facebook', 'instagram', 'tiktok']))]),
  working_hours: z.object({
    enabled: z.boolean(),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    days: z.array(z.number().int().min(0).max(6)),
  }),
});

export async function GET(req: Request) {
  const owner = identity(req);
  if (!owner) return result({ error: 'Unauthorized' }, 401);

  try {
    if (isSupabaseConfigured()) {
      const { users } = await getTeamsAndUsers(DEFAULT_ORG_ID);
      return result({ users });
    }

    const d = db();
    const rows = await d
      .prepare('SELECT id, org_id, name, email, role, channel_access, working_hours, created_at FROM users WHERE org_id = ? ORDER BY created_at ASC')
      .bind(DEFAULT_ORG_ID)
      .all();

    const users = rows.results.map((u: any) => {
      let channel_access = 'all';
      let working_hours = { enabled: false, start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] };
      try {
        channel_access = JSON.parse(u.channel_access);
      } catch {}
      try {
        working_hours = JSON.parse(u.working_hours);
      } catch {}
      return {
        ...u,
        channel_access,
        working_hours,
      };
    });

    return result({ users });
  } catch (err) {
    console.error('Failed to get users:', err);
    return result({ error: 'Could not fetch users' }, 500);
  }
}

export async function POST(req: Request) {
  const owner = identity(req);
  if (!owner) return result({ error: 'Unauthorized' }, 401);

  try {
    const body = await req.json();
    const parsed = userSchema.safeParse(body);
    if (!parsed.success) {
      return result({ error: 'Invalid user data', details: parsed.error.issues }, 400);
    }

    const { id, name, email, role, channel_access, working_hours } = parsed.data;
    const userId = id || `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const isNew = !id;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      await supabase.from('users').upsert(
        {
          id: userId,
          org_id: DEFAULT_ORG_ID,
          name,
          email,
          role,
          channel_access,
          working_hours,
          created_at: now,
        },
        { onConflict: 'id' }
      );

      await logAudit(DEFAULT_ORG_ID, owner, isNew ? 'created_user' : 'updated_user', 'user', userId, {
        name,
        email,
        role,
        channel_access,
      });

      return result({ ok: true, userId });
    }

    const d = db();
    if (isNew) {
      await d
        .prepare(
          'INSERT INTO users (id, org_id, name, email, role, channel_access, working_hours, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          userId,
          DEFAULT_ORG_ID,
          name,
          email,
          role,
          JSON.stringify(channel_access),
          JSON.stringify(working_hours),
          now
        )
        .run();

      await logAudit(DEFAULT_ORG_ID, owner, 'created_user', 'user', userId, {
        name,
        email,
        role,
        channel_access,
      });
    } else {
      await d
        .prepare(
          'UPDATE users SET name = ?, email = ?, role = ?, channel_access = ?, working_hours = ? WHERE id = ? AND org_id = ?'
        )
        .bind(
          name,
          email,
          role,
          JSON.stringify(channel_access),
          JSON.stringify(working_hours),
          userId,
          DEFAULT_ORG_ID
        )
        .run();

      await logAudit(DEFAULT_ORG_ID, owner, 'updated_user', 'user', userId, {
        name,
        email,
        role,
        channel_access,
      });
    }

    return result({ ok: true, userId });
  } catch (err) {
    console.error('Failed to save user:', err);
    return result({ error: 'Could not save user' }, 500);
  }
}
