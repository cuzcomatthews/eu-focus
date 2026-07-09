'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Settings as SettingsIcon, Globe, Clock, User, Save, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useTimerStore } from '@/stores/timerStore';

export default function SettingsPage() {
  const { data: session } = useSession();
  const { focusDuration, breakDuration, setDurations } = useTimerStore();
  const [timezone, setTimezone] = useState('America/Guayaquil');
  const [focus, setFocus] = useState(focusDuration);
  const [breakMin, setBreakMin] = useState(breakDuration);
  const [longBreak, setLongBreak] = useState(15);
  const [name, setName] = useState(() => session?.user?.name || '');
  const [saved, setSaved] = useState(false);

  const saveSettings = async () => {
    setDurations(focus, breakMin);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone, focusDuration: focus, breakDuration: breakMin, longBreakDuration: longBreak, name }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const s = {
    card: { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px', marginBottom: '16px' } as React.CSSProperties,
    title: { fontSize: '16px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' } as React.CSSProperties,
    field: { display: 'flex', flexDirection: 'column' as const, gap: '6px', marginBottom: '16px' },
    label: { fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' } as React.CSSProperties,
    input: { padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px', width: '100%' } as React.CSSProperties,
    btn: { padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' } as React.CSSProperties,
    primary: { background: 'var(--gradient-primary)', color: 'white' } as React.CSSProperties,
    danger: { background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' } as React.CSSProperties,
    row: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' } as React.CSSProperties,
  };

  const timezones = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Guayaquil', 'America/Bogota', 'America/Lima', 'America/Mexico_City',
    'America/Santiago', 'America/Buenos_Aires', 'Europe/London', 'Europe/Madrid',
    'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
    'Australia/Sydney', 'Pacific/Auckland',
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', maxWidth: '700px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <SettingsIcon size={24} /> Settings
      </h1>

      {/* Timezone */}
      <div style={s.card}>
        <div style={s.title}><Globe size={18} /> Timezone</div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Critical for correct streak calculations and daily metrics.
        </p>
        <div style={s.field}>
          <label style={s.label}>Region / Timezone</label>
          <select style={s.input} value={timezone} onChange={e => setTimezone(e.target.value)}>
            {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
      </div>

      {/* Pomodoro Durations */}
      <div style={s.card}>
        <div style={s.title}><Clock size={18} /> Pomodoro Durations</div>
        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Focus (min)</label>
            <input style={s.input} type="number" min={1} max={120} value={focus} onChange={e => setFocus(Number(e.target.value))} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Short Break (min)</label>
            <input style={s.input} type="number" min={1} max={60} value={breakMin} onChange={e => setBreakMin(Number(e.target.value))} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Long Break (min)</label>
            <input style={s.input} type="number" min={1} max={60} value={longBreak} onChange={e => setLongBreak(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Profile */}
      <div style={s.card}>
        <div style={s.title}><User size={18} /> Profile & Account</div>
        <div style={s.field}>
          <label style={s.label}>Display Name</label>
          <input style={s.input} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Email</label>
          <input style={{ ...s.input, opacity: 0.6 }} value={session?.user?.email || ''} disabled />
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button style={{ ...s.btn, ...s.primary }} onClick={saveSettings}>
          <Save size={14} /> Save Settings
        </button>
        {saved && <span style={{ color: 'var(--accent-success)', fontSize: '13px', fontWeight: 500 }}>Settings saved!</span>}
        <button style={{ ...s.btn, ...s.danger, marginLeft: 'auto' }} onClick={() => signOut({ callbackUrl: 'https://eu-focus.vercel.app/login' })}>
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </div>
  );
}
