import { identity, seed, getWorkspace, result } from '@/lib/inbox-server';

export async function GET(req: Request) {
  const owner = identity(req);
  if (!owner) {
    return result({ error: 'Sign in to save your workspace.', preview: true }, 401);
  }

  try {
    await seed(owner);
    const data = await getWorkspace(owner);
    return result(data);
  } catch (e: any) {
    console.error('workspace load failed', e);
    return result({ error: e?.message || 'Your workspace could not load. Please try again.' }, 503);
  }
}
