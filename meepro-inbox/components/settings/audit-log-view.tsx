'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Search, RefreshCw, Filter, Calendar, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { type AuditLogEntry } from '@/lib/inbox-data';
import { toast } from 'sonner';

export default function AuditLogView() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      setLoading(true);
      const res = await fetch('/api/team', {
        headers: { 'oai-authenticated-user-id': 'owner-org-meepro' },
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.logs) {
          setLogs(data.logs);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถโหลดบันทึกการตรวจสอบได้');
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter((log) => {
    const query = search.toLowerCase();
    const matchesSearch =
      log.action.toLowerCase().includes(query) ||
      log.target_type.toLowerCase().includes(query) ||
      log.target_id.toLowerCase().includes(query) ||
      log.user_id.toLowerCase().includes(query) ||
      log.details.toLowerCase().includes(query);

    const matchesAction = filterAction === 'all' || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 rounded-xl">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Security & Audit Trail Explorer
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-medium">
                {logs.length} บันทึก
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              บันทึกประวัติการกระทำ การเปลี่ยนสิทธิ์ ระบบอัตโนมัติ และผลลัพธ์การปิดการขายเพื่อความปลอดภัยและมาตรฐาน
            </p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="p-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="รีเฟรชบันทึก"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาตาม Action, User, Target, หรือข้อความรายละเอียด..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          >
            <option value="all">ทุกกิจกรรม (All Actions)</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 uppercase text-[10px] font-semibold">
                <th className="py-2.5 px-4">วันและเวลา</th>
                <th className="py-2.5 px-4">กิจกรรม (Action)</th>
                <th className="py-2.5 px-4">ผู้ดำเนินการ (Actor)</th>
                <th className="py-2.5 px-4">เป้าหมาย (Target)</th>
                <th className="py-2.5 px-4">รายละเอียด (Audit Details)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredLogs.map((entry) => {
                let parsedDetails = {};
                try {
                  parsedDetails = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details;
                } catch {
                  parsedDetails = { raw: entry.details };
                }

                return (
                  <tr key={entry.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZone: 'Asia/Bangkok',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-medium text-[10px] ${
                          entry.action.includes('auto')
                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                            : entry.action.includes('sales')
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : entry.action.includes('routed')
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {entry.user_id}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      <span className="font-mono">{entry.target_type}</span>: {entry.target_id}
                    </td>
                    <td className="py-3 px-4">
                      <pre className="font-mono text-[10px] p-1.5 bg-slate-50 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300 max-w-md overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(parsedDetails, null, 1)}
                      </pre>
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    ไม่พบบันทึกการตรวจสอบที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
