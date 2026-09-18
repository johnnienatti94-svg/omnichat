import type { Channel, StaffUser, WorkingHours, AutomationsConfig } from './inbox-data';

export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map((s) => parseInt(s, 10));
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Checks if a staff member is currently within their scheduled working hours.
 * Uses Bangkok timezone (Asia/Bangkok, UTC+7) or supplied Date.
 */
export function isStaffOnDuty(workingHours: WorkingHours, date = new Date()): boolean {
  if (!workingHours || workingHours.enabled === false) {
    return true; // No restriction configured
  }

  // Get current hour and minute in Bangkok timezone (UTC+7)
  const bkkTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(date);

  const hourPart = bkkTime.find((p) => p.type === 'hour')?.value ?? '0';
  const minPart = bkkTime.find((p) => p.type === 'minute')?.value ?? '0';
  const currentMinutes = parseInt(hourPart, 10) * 60 + parseInt(minPart, 10);

  // Day of week in Bangkok: 0=Sun, 1=Mon, ..., 6=Sat
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'narrow',
  });
  // Alternative robust day calculation:
  const utcOffsetMs = 7 * 60 * 60 * 1000;
  const bkkDate = new Date(date.getTime() + utcOffsetMs);
  const dayOfWeek = bkkDate.getUTCDay();

  if (!workingHours.days.includes(dayOfWeek)) {
    return false;
  }

  const startMin = parseTimeToMinutes(workingHours.start);
  const endMin = parseTimeToMinutes(workingHours.end);

  return currentMinutes >= startMin && currentMinutes <= endMin;
}

/**
 * Verifies if an agent has permission to service messages from the specified channel.
 */
export function canStaffHandleChannel(staff: Pick<StaffUser, 'channel_access'>, channel: Channel): boolean {
  if (!staff.channel_access || staff.channel_access === 'all') {
    return true;
  }
  if (Array.isArray(staff.channel_access)) {
    return staff.channel_access.includes(channel);
  }
  try {
    const parsed = JSON.parse(staff.channel_access as unknown as string);
    if (parsed === 'all') return true;
    if (Array.isArray(parsed)) return parsed.includes(channel);
  } catch {
    // fallback
  }
  return false;
}

export type RoutingResult = {
  assignee: string | null;
  assigneeName?: string;
  reason: 'previous_agent' | 'round_robin' | 'off_hours' | 'no_on_duty_agent';
  details?: Record<string, unknown>;
};

/**
 * Evaluates intelligent routing rules to assign an incoming conversation:
 * 1. Checks previous-agent affinity if enabled and customer has history.
 * 2. Distributes via least-busy round-robin among active, on-duty agents with channel access.
 * 3. Falls back to unassigned queue if outside working hours or no agents available.
 */
export async function routeInboundConversation(params: {
  orgId: string;
  channel: Channel;
  customerId?: string;
  d1: any;
  now?: Date;
  overrideConfig?: Partial<AutomationsConfig>;
}): Promise<RoutingResult> {
  const { orgId, channel, customerId, d1, now = new Date() } = params;

  // 1. Fetch organization automations configuration
  let config: any = params.overrideConfig;
  if (!config) {
    const row = await d1
      .prepare('SELECT routing_mode, previous_agent_affinity FROM automations WHERE org_id = ?')
      .bind(orgId)
      .first();
    config = row || { routing_mode: 'round_robin', previous_agent_affinity: 1 };
  }

  if (config.routing_mode === 'manual') {
    return { assignee: null, reason: 'no_on_duty_agent', details: { routing_mode: 'manual' } };
  }

  // 2. Fetch all staff users for the organization
  const staffRows = await d1
    .prepare('SELECT id, name, role, channel_access, working_hours FROM users WHERE org_id = ?')
    .bind(orgId)
    .all();

  const allStaff = (staffRows.results || []).map((u: any) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    channel_access: typeof u.channel_access === 'string' ? JSON.parse(u.channel_access) : u.channel_access,
    working_hours: typeof u.working_hours === 'string' ? JSON.parse(u.working_hours) : u.working_hours,
  }));

  // 3. Filter staff by channel access
  const channelStaff = allStaff.filter((s: any) => canStaffHandleChannel(s, channel));

  if (channelStaff.length === 0) {
    return { assignee: null, reason: 'no_on_duty_agent', details: { channel, availableStaff: 0 } };
  }

  // 4. Filter staff by working hours (on duty)
  const onDutyStaff = channelStaff.filter((s: any) => isStaffOnDuty(s.working_hours, now));

  // 5. Test previous-agent affinity if customerId is provided
  if (config.previous_agent_affinity && customerId) {
    const previousConv = await d1
      .prepare(
        `SELECT assignee FROM conversations 
         WHERE customer_id = ? AND assignee != '' AND assignee != 'me'
         ORDER BY updated_at DESC LIMIT 1`
      )
      .bind(customerId)
      .first();

    if (previousConv && previousConv.assignee) {
      const prevAgent = onDutyStaff.find((s: any) => s.id === previousConv.assignee);
      if (prevAgent) {
        return {
          assignee: prevAgent.id,
          assigneeName: prevAgent.name,
          reason: 'previous_agent',
          details: { previousAgentId: prevAgent.id, customerId },
        };
      }
    }
  }

  // 6. If no on-duty staff available, mark as off-hours or unassigned
  if (onDutyStaff.length === 0) {
    return {
      assignee: null,
      reason: 'off_hours',
      details: { totalEligible: channelStaff.length, onDuty: 0 },
    };
  }

  // 7. Balanced Round-Robin: Pick the on-duty agent with the lowest open ticket count
  const openCountRows = await d1
    .prepare(
      `SELECT assignee, COUNT(*) as open_count 
       FROM conversations 
       WHERE status = 'open' AND assignee != ''
       GROUP BY assignee`
    )
    .all();

  const countMap = new Map<string, number>();
  for (const row of openCountRows.results || []) {
    countMap.set(row.assignee, Number(row.open_count));
  }

  // Sort on-duty staff by open conversation workload (ascending)
  const sortedStaff = [...onDutyStaff].sort((a, b) => {
    const countA = countMap.get(a.id) ?? 0;
    const countB = countMap.get(b.id) ?? 0;
    return countA - countB;
  });

  const chosenAgent = sortedStaff[0];

  return {
    assignee: chosenAgent.id,
    assigneeName: chosenAgent.name,
    reason: 'round_robin',
    details: {
      candidates: onDutyStaff.map((s: any) => s.id),
      selectedWorkload: countMap.get(chosenAgent.id) ?? 0,
    },
  };
}
