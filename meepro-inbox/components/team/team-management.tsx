'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Clock,
  Plus,
  Search,
  Check,
  Edit2,
  Calendar,
  History,
  UserCheck,
  Building,
  Info,
} from 'lucide-react';
import {
  type StaffUser,
  type Team,
  type UserRole,
  type Channel,
  roleLabels,
  channelNames,
} from '@/lib/inbox-data';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import AuditLogView from '@/components/settings/audit-log-view';

interface TeamManagementProps {
  initialUsers?: StaffUser[];
  initialTeams?: Team[];
  currentUserRole?: UserRole;
  onRefresh?: () => Promise<void>;
}

export default function TeamManagement({
  initialUsers = [],
  initialTeams = [],
  currentUserRole = 'admin',
  onRefresh,
}: TeamManagementProps) {
  const [users, setUsers] = useState<StaffUser[]>(initialUsers);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'logs'>('users');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    email: string;
    role: UserRole;
    channel_access: 'all' | Channel[];
    working_hours: {
      enabled: boolean;
      start: string;
      end: string;
      days: number[];
    };
  }>({
    name: '',
    email: '',
    role: 'agent',
    channel_access: 'all',
    working_hours: {
      enabled: true,
      start: '09:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5],
    },
  });

  const [saving, setSaving] = useState(false);

  // Fetch users & teams from API
  async function loadData() {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data: any = await res.json();
        if (data.users) setUsers(data.users);
      }
      const tRes = await fetch('/api/team');
      if (tRes.ok) {
        const tData: any = await tRes.json();
        if (tData.teams) setTeams(tData.teams);
        if (tData.logs) setLogs(tData.logs);
      }
    } catch (err) {
      console.error('Failed to load team data:', err);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleOpenAdd() {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      role: 'agent',
      channel_access: 'all',
      working_hours: {
        enabled: true,
        start: '09:00',
        end: '18:00',
        days: [1, 2, 3, 4, 5],
      },
    });
    setModalOpen(true);
  }

  function handleOpenEdit(user: StaffUser) {
    setEditingUser(user);
    setFormData({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      channel_access: user.channel_access,
      working_hours: user.working_hours || {
        enabled: false,
        start: '09:00',
        end: '18:00',
        days: [1, 2, 3, 4, 5],
      },
    });
    setModalOpen(true);
  }

  async function handleSubmitUser(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Please enter name and email');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save user');

      toast.success(editingUser ? 'User updated successfully' : 'Staff member invited successfully');
      setModalOpen(false);
      await loadData();
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Error saving user');
    } finally {
      setSaving(false);
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      roleLabels[u.role]?.th.includes(search)
  );

  const dayLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  return (
    <div className="content-page">
      <div className="section-toolbar">
        <div>
          <h2>Team Management (จัดการทีมและเจ้าหน้าที่)</h2>
          <p className="muted">
            Manage staff accounts, explicit roles, channel permissions, and working hours for automated assignment.
          </p>
        </div>
        <button className="primary" onClick={handleOpenAdd}>
          <Plus size={16} /> Add Staff Member (เพิ่มเจ้าหน้าที่)
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="mb-6 bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="users" className="flex items-center gap-2 px-4 py-2">
            <Users size={16} /> Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex items-center gap-2 px-4 py-2">
            <Building size={16} /> Teams ({teams.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2 px-4 py-2">
            <History size={16} /> Activity Log ({logs.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: USERS */}
        <TabsContent value="users">
          <div className="flex items-center justify-between mb-4">
            <div className="searchbox">
              <Search size={15} />
              <input
                placeholder="Search staff by name, email, or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing {filteredUsers.length} staff member{filteredUsers.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="table-card shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="p-4 font-semibold text-xs text-slate-600">STAFF MEMBER</th>
                  <th className="p-4 font-semibold text-xs text-slate-600">ROLE (บทบาท)</th>
                  <th className="p-4 font-semibold text-xs text-slate-600">CHANNEL ACCESS (ช่องทางที่ดูแล)</th>
                  <th className="p-4 font-semibold text-xs text-slate-600">WORKING HOURS (เวลาทำการ)</th>
                  <th className="p-4 font-semibold text-xs text-slate-600 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const role = roleLabels[u.role] || { en: u.role, th: u.role };
                  const isAllChannels = u.channel_access === 'all' || !Array.isArray(u.channel_access);
                  const channelsList: Channel[] = isAllChannels ? ['facebook', 'instagram', 'tiktok'] : (u.channel_access as Channel[]);
                  const wh = u.working_hours;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-semibold flex items-center justify-center text-sm">
                            {u.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 text-sm">{u.name}</div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            u.role === 'admin'
                              ? 'bg-orange-100 text-orange-800 border border-orange-200'
                              : u.role === 'supervisor'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <Shield size={12} />
                          {role.th} ({role.en})
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {isAllChannels ? (
                            <span className="px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                              All Channels (ทุกช่องทาง)
                            </span>
                          ) : (
                            channelsList.map((ch) => (
                              <span
                                key={ch}
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  ch === 'facebook'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : ch === 'instagram'
                                    ? 'bg-pink-50 text-pink-700 border border-pink-200'
                                    : 'bg-slate-100 text-slate-800 border border-slate-200'
                                }`}
                              >
                                {channelNames[ch as Channel] || ch}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {wh && wh.enabled ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>
                              {wh.start} - {wh.end}
                            </span>
                            <span className="text-slate-400">
                              ({(wh.days || []).map((d) => dayLabels[d]).join(', ')})
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                            <span>24 Hours / No restriction</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          className="outline text-xs px-3 py-1.5"
                          onClick={() => handleOpenEdit(u)}
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 2: TEAMS */}
        <TabsContent value="teams">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {teams.map((t) => (
              <div key={t.id} className="table-card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                        <Building size={16} />
                      </div>
                      <h3 className="font-semibold text-slate-900 text-base">{t.name}</h3>
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      Active Team
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Assigned incoming enquiries and round-robin distribution during working hours.
                  </p>
                  <div className="border-t border-slate-100 pt-3 text-xs flex justify-between text-slate-600">
                    <span>Team Leader:</span>
                    <span className="font-medium text-slate-800">
                      {users.find((u) => u.id === t.leader_id)?.name || 'Not assigned'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* TAB 3: ACTIVITY LOG */}
        <TabsContent value="logs">
          <div className="mt-4">
            <AuditLogView />
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOG: ADD/EDIT STAFF USER */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg bg-white rounded-xl shadow-2xl p-6 border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <UserCheck className="text-orange-500" size={20} />
              {editingUser ? 'Edit Staff Member (แก้ไขข้อมูลเจ้าหน้าที่)' : 'Invite Staff Member (เพิ่มเจ้าหน้าที่)'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitUser} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">FULL NAME (ชื่อ-นามสกุล)</label>
              <input
                type="text"
                required
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-orange-500"
                placeholder="เช่น สมชาย ใจดี"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">EMAIL (อีเมลเข้าสู่ระบบ)</label>
              <input
                type="email"
                required
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-orange-500"
                placeholder="somchai@meepro.store"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ROLE (บทบาทและสิทธิ์)</label>
              <select
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-orange-500 bg-white"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              >
                <option value="agent">แอดมิน (Agent) — จัดการและตอบแชทตามช่องทางที่ได้รับมอบหมาย</option>
                <option value="supervisor">หัวหน้าทีม (Supervisor) — ดูแลแชททั้งหมด มอบหมายงาน และดูรายงาน</option>
                <option value="admin">ผู้ดูแลบัญชี (Admin) — สิทธิ์สูงสุด จัดการทีม เชื่อมต่อช่องทาง และตั้งค่าระบบ</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                CHANNEL ACCESS (สิทธิ์การเข้าถึงช่องทางโซเชียล)
              </label>
              <div className="space-y-2 mt-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="channel_scope"
                    checked={formData.channel_access === 'all'}
                    onChange={() => setFormData({ ...formData, channel_access: 'all' })}
                  />
                  <span>All Channels (เข้าถึงทุกช่องทาง)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="channel_scope"
                    checked={formData.channel_access !== 'all'}
                    onChange={() => setFormData({ ...formData, channel_access: ['facebook'] })}
                  />
                  <span>Select Specific Channels (เลือกเฉพาะบางช่องทาง)</span>
                </label>

                {formData.channel_access !== 'all' && (
                  <div className="pl-6 pt-2 space-y-1.5 border-t border-slate-200/60 mt-2">
                    {(['facebook', 'instagram', 'tiktok'] as Channel[]).map((ch) => {
                      const selected =
                        Array.isArray(formData.channel_access) && formData.channel_access.includes(ch);
                      return (
                        <label key={ch} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(e) => {
                              const curr = Array.isArray(formData.channel_access)
                                ? [...formData.channel_access]
                                : [];
                              const next = e.target.checked
                                ? [...curr, ch]
                                : curr.filter((c) => c !== ch);
                              setFormData({ ...formData, channel_access: next.length > 0 ? next : [ch] });
                            }}
                          />
                          <span>{channelNames[ch]}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* WORKING HOURS */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Clock size={14} className="text-orange-500" /> WORKING HOURS (เวลาทำการ)
                </label>
                <input
                  type="checkbox"
                  checked={formData.working_hours.enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      working_hours: { ...formData.working_hours, enabled: e.target.checked },
                    })
                  }
                />
              </div>

              {formData.working_hours.enabled && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">Start Time</span>
                      <input
                        type="time"
                        className="w-full border border-slate-200 rounded p-1.5 text-xs bg-white"
                        value={formData.working_hours.start}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            working_hours: { ...formData.working_hours, start: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">End Time</span>
                      <input
                        type="time"
                        className="w-full border border-slate-200 rounded p-1.5 text-xs bg-white"
                        value={formData.working_hours.end}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            working_hours: { ...formData.working_hours, end: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1.5">Active Days</span>
                    <div className="flex gap-1.5">
                      {dayLabels.map((lbl, idx) => {
                        const active = formData.working_hours.days.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              const curr = formData.working_hours.days;
                              const next = active
                                ? curr.filter((d) => d !== idx)
                                : [...curr, idx];
                              setFormData({
                                ...formData,
                                working_hours: { ...formData.working_hours, days: next },
                              });
                            }}
                            className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                              active
                                ? 'bg-orange-500 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 p-2 rounded">
                    <Info size={13} className="shrink-0 mt-0.5" />
                    <span>
                      เวลาทำการนี้ใช้สำหรับการกระจายงานอัตโนมัติ (Automatic Ticket Assignment)
                      โดยจะไม่จำกัดเวลาล็อกอินของเจ้าหน้าที่
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="outline text-xs px-4 py-2"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="primary text-xs px-4 py-2" disabled={saving}>
                {saving ? 'Saving...' : editingUser ? 'Update Staff Member' : 'Add Staff Member'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
