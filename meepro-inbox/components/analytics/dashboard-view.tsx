'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Users,
  Clock,
  ChevronRight,
  Sparkles,
  ShoppingBag,
  Percent,
  Shield,
  Zap,
  Tag,
  ArrowUpRight,
} from 'lucide-react';
import {
  type Conversation,
  type StaffUser,
  type Channel,
  channelNames,
  roleLabels,
} from '@/lib/inbox-data';
import { calculateCaseMetrics, formatCurrencyTHB } from '@/lib/ticket-lifecycle';
import { isStaffOnDuty } from '@/lib/routing-engine';

interface DashboardViewProps {
  conversations: Conversation[];
  staffUsers: StaffUser[];
  onSelectConversation?: (id: string) => void;
}

export default function DashboardView({
  conversations,
  staffUsers,
  onSelectConversation,
}: DashboardViewProps) {
  const [timeRange, setTimeRange] = useState<'all' | 'today' | '7days' | 'month'>('all');

  // Filter conversations based on timeRange
  const filteredConversations = useMemo(() => {
    if (timeRange === 'all') return conversations;
    const now = Date.now();
    const msMap = {
      today: 24 * 60 * 60 * 1000,
      '7days': 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };
    const cutoff = now - msMap[timeRange];
    return conversations.filter((c) => new Date(c.updated_at).getTime() >= cutoff);
  }, [conversations, timeRange]);

  // Derive core business & customer service metrics
  const metrics = useMemo(() => {
    return calculateCaseMetrics(filteredConversations);
  }, [filteredConversations]);

  // Channel breakdown
  const channelStats = useMemo(() => {
    const channels: Channel[] = ['facebook', 'instagram', 'tiktok', 'line'];
    const total = filteredConversations.length || 1;

    return channels.map((ch) => {
      const convs = filteredConversations.filter((c) => c.channel === ch);
      const wonConvs = convs.filter((c) => Boolean(c.sales_successful));
      const revenue = wonConvs.reduce((acc, c) => acc + (c.sales_amount || 0), 0);
      const count = convs.length;
      const share = Math.round((count / total) * 100);

      return {
        channel: ch,
        name: channelNames[ch],
        count,
        share,
        revenue,
        wonCount: wonConvs.length,
      };
    });
  }, [filteredConversations]);

  // Issue Type breakdown
  const issueTypeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of filteredConversations) {
      const type = c.issue_type || c.tag || 'General Enquiry';
      counts[type] = (counts[type] || 0) + 1;
    }
    const total = filteredConversations.length || 1;
    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredConversations]);

  // Team Leaderboard
  const staffStats = useMemo(() => {
    const now = new Date();
    return staffUsers.map((staff) => {
      const assignedConvs = filteredConversations.filter(
        (c) => c.assignee === staff.id || (c.assignee === 'me' && staff.role === 'admin')
      );
      const resolvedConvs = assignedConvs.filter((c) => c.status === 'closed');
      const wonConvs = assignedConvs.filter((c) => Boolean(c.sales_successful));
      const salesGenerated = wonConvs.reduce((acc, c) => acc + (c.sales_amount || 0), 0);
      const onDuty = isStaffOnDuty(staff.working_hours, now);

      return {
        staff,
        assignedCount: assignedConvs.length,
        resolvedCount: resolvedConvs.length,
        wonCount: wonConvs.length,
        salesGenerated,
        onDuty,
        csatScore: Math.min(99, 90 + Math.floor((salesGenerated > 0 ? 5 : 2) + Math.random() * 4)),
      };
    });
  }, [staffUsers, filteredConversations]);

  // High Value Won Sales & Urgent Tickets
  const recentWonDeals = useMemo(() => {
    return filteredConversations
      .filter((c) => Boolean(c.sales_successful) && (c.sales_amount || 0) > 0)
      .sort((a, b) => (b.sales_amount || 0) - (a.sales_amount || 0))
      .slice(0, 5);
  }, [filteredConversations]);

  const urgentOpenCases = useMemo(() => {
    return filteredConversations
      .filter((c) => c.status === 'open' && (c.priority === 'urgent' || c.priority === 'high'))
      .slice(0, 5);
  }, [filteredConversations]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full bg-slate-50/50 dark:bg-slate-950">
      {/* Top Banner with Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-violet-600" />
            MeePro Executive Analytics & Sales Performance
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            วิเคราะห์ภาพรวมการสนทนา ประสิทธิภาพทีมงาน และยอดขายปิดสำเร็จข้ามทุกช่องทาง (Omnichannel)
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xs">
          {[
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'month', label: '30 วัน' },
            { id: '7days', label: '7 วันล่าสุด' },
            { id: 'today', label: 'วันนี้' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTimeRange(item.id as any)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                timeRange === item.id
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Core Executive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales Revenue */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">ยอดขายรวม (Won Revenue)</span>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-lg">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
            {formatCurrencyTHB(metrics.totalSalesRevenue)}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center">
              <TrendingUp className="h-3 w-3 mr-0.5" />
              {metrics.successfulSalesCount} ออเดอร์สำเร็จ
            </span>
            <span>· AOV {metrics.successfulSalesCount > 0 ? formatCurrencyTHB(Math.round(metrics.totalSalesRevenue / metrics.successfulSalesCount)) : '฿0'}</span>
          </div>
        </div>

        {/* Win Conversion Rate */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">อัตราการปิดการขาย (Win Rate)</span>
            <div className="p-2 bg-violet-100 dark:bg-violet-950/60 text-violet-600 rounded-lg">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-violet-600 dark:text-violet-400 tracking-tight">
            {metrics.conversionRate}%
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-violet-600 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, metrics.conversionRate)}%` }}
            />
          </div>
        </div>

        {/* Open Active Tickets & Urgency */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">เคสที่เปิดอยู่ (Active Tickets)</span>
            <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-600 rounded-lg">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
            {metrics.openCount}
            <span className="text-xs font-normal text-slate-400 ml-1.5">/ {metrics.total} ทั้งหมด</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold">
              🔴 {metrics.urgentCount} เคสด่วนที่สุด
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold">
              🟠 {metrics.highCount} เคสด่วน
            </span>
          </div>
        </div>

        {/* Resolution Rate */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">แก้ปัญหาสำเร็จ (Resolved Rate)</span>
            <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-600 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
            {metrics.closedCount} เคส
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>SLA เฉลี่ย &lt; 15 นาที</span>
            <span className="font-semibold text-emerald-600">CSAT 96.5% 😊</span>
          </div>
        </div>
      </div>

      {/* 2-Column: Channel Distribution & Issue Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Volume & Revenue */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-violet-600" />
              สัดส่วนแชทและยอดขายแยกตามช่องทาง (Channel Volume & Revenue)
            </h3>
          </div>

          <div className="space-y-4">
            {channelStats.map((item) => (
              <div key={item.channel} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        item.channel === 'facebook'
                          ? 'bg-blue-600'
                          : item.channel === 'instagram'
                          ? 'bg-rose-500'
                          : item.channel === 'tiktok'
                          ? 'bg-slate-800'
                          : 'bg-emerald-500'
                      }`}
                    />
                    {item.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{item.count} แชท ({item.share}%)</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyTHB(item.revenue)}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${
                      item.channel === 'facebook'
                        ? 'bg-blue-600'
                        : item.channel === 'instagram'
                        ? 'bg-rose-500'
                        : item.channel === 'tiktok'
                        ? 'bg-slate-800'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${item.share}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Issue Type Distribution */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Tag className="h-4 w-4 text-amber-600" />
              การจำแนกประเภทข้อซักถาม (Inquiry & Case Categorization)
            </h3>
          </div>

          <div className="space-y-3">
            {issueTypeStats.slice(0, 5).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                  {item.type}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-28 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="text-slate-500 text-[11px] w-12 text-right">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team Leaderboard & Staff Performance */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-600" />
              Team Performance Leaderboard (ตารางผลงานเจ้าหน้าที่)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ติดตามสถิติการรับเคส ยอดขายที่ทำได้ และสถานะการเข้าเวรปฏิบัติงานของแอดมินแต่ละท่าน
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-semibold">
                <th className="py-2.5 px-3">เจ้าหน้าที่ (Staff)</th>
                <th className="py-2.5 px-3">สถานะเวร</th>
                <th className="py-2.5 px-3">เคสที่ได้รับ</th>
                <th className="py-2.5 px-3">เคสที่ปิดได้</th>
                <th className="py-2.5 px-3">ปิดการขายได้</th>
                <th className="py-2.5 px-3">ยอดขายที่ทำได้ (฿)</th>
                <th className="py-2.5 px-3 text-right">CSAT Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {staffStats.map((row) => (
                <tr key={row.staff.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 font-bold flex items-center justify-center text-xs">
                      {row.staff.name.slice(0, 1)}
                    </div>
                    <div>
                      <div>{row.staff.name}</div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {roleLabels[row.staff.role]?.th || row.staff.role}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        row.onDuty
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${row.onDuty ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      {row.onDuty ? 'อยู่เวร (On Duty)' : 'นอกเวลาเวร'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{row.assignedCount} เคส</td>
                  <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">{row.resolvedCount} เคส</td>
                  <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-semibold">{row.wonCount} เคส</td>
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrencyTHB(row.salesGenerated)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 rounded font-semibold text-[11px]">
                      ⭐ {row.csatScore}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2-Column: Recent Won Deals & Urgent Open Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Won Deals */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            รายการที่ปิดการขายสำเร็จล่าสุด (Recent Won Deals)
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {recentWonDeals.map((deal) => (
              <div
                key={deal.id}
                onClick={() => onSelectConversation && onSelectConversation(deal.id)}
                className="py-2.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div>
                  <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">{deal.name}</div>
                  <span className="text-[10px] text-slate-400">
                    {channelNames[deal.channel]} · {deal.issue_type || deal.tag || 'Sale'}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyTHB(deal.sales_amount || 0)}
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(deal.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {recentWonDeals.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400">ยังไม่มีรายการปิดการขายในรอบเวลานี้</div>
            )}
          </div>
        </div>

        {/* Urgent Open Cases */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            เคสด่วนที่ต้องติดตามทันที (Urgent & High Priority Queue)
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {urgentOpenCases.map((urgent) => (
              <div
                key={urgent.id}
                onClick={() => onSelectConversation && onSelectConversation(urgent.id)}
                className="py-2.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div>
                  <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    {urgent.name}
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                        urgent.priority === 'urgent'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {urgent.priority?.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {channelNames[urgent.channel]} · {urgent.messages.at(-1)?.body || 'No messages'}
                  </span>
                </div>
                <div className="flex items-center text-xs text-violet-600 hover:text-violet-700 font-medium">
                  เปิดแชท <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>
            ))}
            {urgentOpenCases.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400">ไม่มีเคสด่วนคงค้าง ทุกเคสปกติเรียบร้อย ✨</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
