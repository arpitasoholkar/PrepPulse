import React, { useEffect, useState } from 'react';
import { Flame, Trophy, Clock, CircleCheck, Pencil, Check, X } from 'lucide-react';
import Layout from '../../components/Layout.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import Loader from '../../components/Loader.jsx';
import { Avatar } from '../../components/UserMenu.jsx';
import HoursChart from '../../components/activity/HoursChart.jsx';
import ActivityCalendar from '../../components/activity/ActivityCalendar.jsx';
import BadgeIcon, { tierInfo } from '../../components/activity/BadgeIcon.jsx';
import { useActivity } from '../../context/ActivityContext.jsx';
import { useUser } from '../../context/UserContext.jsx';
import { getProfile, updateProfile } from '../../api/activity.js';
import { getErrorMessage } from '../../api/client.js';
import { hoursFromMinutes, prettyDate } from '../../lib/format.js';

function Stat({ icon: Icon, label, value, unit, bg, fg }) {
  return (
    <div className="glass rounded-[24px] p-5 flex items-center gap-4">
      <span className="grid place-items-center w-12 h-12 rounded-2xl shrink-0" style={{ background: bg, color: fg }} aria-hidden="true">
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-ink leading-none">
          {value}{unit && <span className="ml-1 text-sm font-bold text-ink-soft">{unit}</span>}
        </p>
        <p className="mt-1 text-sm text-ink-soft truncate">{label}</p>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, setUser } = useUser() || {};
  const { summary } = useActivity();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', targetRole: '' });
  const [saving, setSaving] = useState(false);

  // Reload when attempts or badges change elsewhere in the app
  const stamp = `${summary?.totals?.attempts ?? ''}-${summary?.badges?.filter((b) => b.earned).length ?? ''}`;
  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((res) => { if (!cancelled) setProfile(res.data); })
      .catch((err) => { if (!cancelled) setError(getErrorMessage(err, 'Could not load your profile.')); });
    return () => { cancelled = true; };
  }, [stamp]);

  const startEdit = () => {
    setForm({ name: profile?.user?.name || user?.name || '', targetRole: profile?.user?.targetRole || user?.targetRole || '' });
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const res = await updateProfile({ name: form.name, targetRole: form.targetRole });
      setProfile((p) => ({ ...p, user: res.data.user }));
      setUser({ ...user, name: res.data.user.name, targetRole: res.data.user.targetRole });
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your changes.'));
    } finally {
      setSaving(false);
    }
  };

  const u = profile?.user || user;
  const badges = profile?.badges || [];
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);
  const t = profile?.totals;
  const inputCls = 'w-full rounded-full border border-[#ececf2] bg-white px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-violet-400';

  return (
    <Layout>
      {error && <ErrorBanner error={error} onDismiss={() => setError(null)} className="mb-4" />}
      {!profile ? (
        <Loader label="Loading your profile…" className="py-24" />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Identity */}
          <section className="glass rounded-[28px] p-6 flex flex-col sm:flex-row sm:items-center gap-5" aria-label="Profile">
            <Avatar name={u?.name} size="w-20 h-20 text-3xl" />
            {editing ? (
              <form onSubmit={save} className="flex-1 grid sm:grid-cols-2 gap-3 items-end">
                <label className="block text-xs font-bold text-ink-soft">
                  <span className="ml-3">Name</span>
                  <input className={`${inputCls} mt-1`} value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </label>
                <label className="block text-xs font-bold text-ink-soft">
                  <span className="ml-3">Target role</span>
                  <input className={`${inputCls} mt-1`} value={form.targetRole} maxLength={60} onChange={(e) => setForm({ ...form, targetRole: e.target.value })} />
                </label>
                <div className="sm:col-span-2 flex gap-2">
                  <button type="submit" disabled={saving} className="btn-pill inline-flex items-center gap-1.5 px-5 py-2.5 text-sm disabled:opacity-60"><Check className="w-4 h-4" />{saving ? 'Saving…' : 'Save'}</button>
                  <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 rounded-full border border-[#ececf2] bg-white px-5 py-2.5 text-sm font-bold text-ink"><X className="w-4 h-4" />Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-extrabold tracking-tight text-ink truncate">{u?.name}</h2>
                  <p className="text-sm text-ink-soft truncate">{u?.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-[#e4e1fb] px-3 py-1 text-[#4b3fa8]">{u?.targetRole || 'SDE'}</span>
                    <span className="rounded-full bg-[#f1f0f6] px-3 py-1 text-ink-soft">Joined {u?.createdAt ? prettyDate(String(u.createdAt).slice(0, 10)) : 'recently'}</span>
                    <span className="rounded-full bg-[#eaf6b8] px-3 py-1 text-[#4d6600]">{profile.badgesEarned}/{profile.badgesTotal} badges</span>
                  </div>
                </div>
                <button type="button" onClick={startEdit} className="inline-flex items-center gap-2 self-start sm:self-center rounded-full border border-[#ececf2] bg-white px-5 py-2.5 text-sm font-bold text-ink hover:bg-[#f6f5fa] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
                  <Pencil className="w-4 h-4" /> Edit
                </button>
              </>
            )}
          </section>

          {/* Numbers */}
          <section className="grid grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Stats">
            <Stat icon={Flame} label="Current streak" value={profile.streak.current} unit={profile.streak.current === 1 ? 'day' : 'days'} bg="#fde3d6" fg="#c2562a" />
            <Stat icon={Trophy} label="Longest streak" value={profile.streak.longest} unit={profile.streak.longest === 1 ? 'day' : 'days'} bg="#fdeccd" fg="#a86a00" />
            <Stat icon={Clock} label="Time learning" value={hoursFromMinutes(t.minutes)} unit="h" bg="#e4e1fb" fg="#4b3fa8" />
            <Stat icon={CircleCheck} label={`Passed · ${t.passRate}% pass rate`} value={t.passes} bg="#eaf6b8" fg="#5f7a00" />
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_370px] gap-6">
            <div className="min-w-0 flex flex-col gap-6">
              {/* Badges */}
              <section className="glass rounded-[28px] p-6" aria-label="Badges">
                <h2 className="text-2xl font-extrabold tracking-tight text-ink">Badges</h2>
                <p className="text-sm text-ink-soft">{earned.length} earned, {locked.length} to go</p>

                <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
                  {[...earned, ...locked].map((b) => (
                    <li key={b.key} className={`rounded-[22px] border p-4 flex gap-3.5 ${b.earned ? 'border-[#ececf2] bg-white' : 'border-dashed border-[#dcdce8] bg-[#faf9fc]'}`}>
                      <BadgeIcon icon={b.icon} tier={b.tier} earned={b.earned} size="w-14 h-14" iconSize="w-6 h-6" />
                      <div className="min-w-0 flex-1">
                        <p className={`font-bold truncate ${b.earned ? 'text-ink' : 'text-ink-soft'}`}>{b.name}</p>
                        <p className="text-xs text-ink-soft">{b.description}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase" style={{ background: tierInfo(b.tier).bg, color: tierInfo(b.tier).fg }}>{tierInfo(b.tier).label}</span>
                          {b.earned ? (
                            <span className="text-[11px] font-semibold text-emerald-700 truncate">Earned {prettyDate(String(b.earnedAt).slice(0, 10))}</span>
                          ) : (
                            <>
                              <span className="h-1.5 flex-1 rounded-full bg-[#ececf2] overflow-hidden">
                                <span className="block h-full rounded-full bg-[#7c5cff]" style={{ width: `${(b.progress / b.target) * 100}%` }} />
                              </span>
                              <span className="text-[11px] font-semibold text-ink-soft tabular-nums">{b.progress}/{b.target}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <HoursChart week={summary?.week} />
            </div>

            <div className="min-w-0">
              <ActivityCalendar />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
