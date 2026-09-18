import { db, identity, seed, result, DEFAULT_ORG_ID } from '@/lib/inbox-server';

export async function GET(req: Request) {
  const owner = identity(req);
  if (!owner) {
    return result({ error: 'Sign in to save your workspace.', preview: true }, 401);
  }

  try {
    await seed(owner);
    const d = db();

    const [c, m, r, s, u, t, conn] = await Promise.all([
      d
        .prepare(
          `SELECT id, name, channel, handle, status, assignee, tag, notes,
                  priority, issue_type, resolution, sales_amount, sales_successful,
                  closed_at, closed_by, customer_id, updated_at
           FROM conversations
           WHERE owner = ?
           ORDER BY updated_at DESC`
        )
        .bind(owner)
        .all(),
      d
        .prepare(
          `SELECT id, conversation_id, body, direction, attachments, external_id, delivery_status, created_at
           FROM messages
           WHERE owner = ?
           ORDER BY created_at, id`
        )
        .bind(owner)
        .all(),
      d.prepare('SELECT id, title, body FROM replies WHERE owner = ? ORDER BY title').bind(owner).all(),
      d.prepare('SELECT channel, account, url FROM channel_setup WHERE owner = ?').bind(owner).all(),
      d
        .prepare('SELECT id, org_id, name, email, role, channel_access, working_hours, created_at FROM users WHERE org_id = ?')
        .bind(DEFAULT_ORG_ID)
        .all(),
      d.prepare('SELECT id, org_id, name, leader_id, created_at FROM teams WHERE org_id = ?').bind(DEFAULT_ORG_ID).all(),
      d
        .prepare('SELECT id, org_id, channel, name, account_id, status, created_at FROM channel_connections WHERE org_id = ?')
        .bind(DEFAULT_ORG_ID)
        .all(),
    ]);

    const conversations = c.results.map((conv: any) => ({
      ...conv,
      sales_successful: Boolean(conv.sales_successful),
      messages: m.results
        .filter((msg: any) => msg.conversation_id === conv.id)
        .map((msg: any) => {
          let attachments = [];
          try {
            attachments = typeof msg.attachments === 'string' ? JSON.parse(msg.attachments) : msg.attachments || [];
          } catch {
            attachments = [];
          }
          return {
            ...msg,
            attachments,
          };
        }),
    }));

    const users = u.results.map((user: any) => {
      let channel_access = 'all';
      let working_hours = { enabled: false, start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] };
      try {
        channel_access = JSON.parse(user.channel_access);
      } catch {}
      try {
        working_hours = JSON.parse(user.working_hours);
      } catch {}
      return {
        ...user,
        channel_access,
        working_hours,
      };
    });

    return result({
      conversations,
      replies: r.results,
      setup: s.results,
      users,
      teams: t.results,
      connections: conn.results,
    });
  } catch (e) {
    console.error('workspace load failed', e);
    return result({ error: 'Your workspace could not load. Please try again.' }, 503);
  }
}
