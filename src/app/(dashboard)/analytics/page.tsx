'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Clock, Flame, Zap, Target, TrendingUp, Download, Calendar } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area
} from 'recharts';

interface AnalyticsData {
  totalPomodoros: number;
  totalMinutes: number;
  recentPomodoros: number;
  recentMinutes: number;
  uniqueDaysLast7d: number;
  dailyAvgMinutes: number;
  timeByHabit: { name: string; color: string; minutes: number }[];
  heatmap: Record<string, number>;
  peakHours: number[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetch('/api/analytics').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  const totalHours = data ? Math.round(data.totalMinutes / 60 * 10) / 10 : 0;
  const recentHours = data ? Math.round(data.recentMinutes / 60 * 10) / 10 : 0;

  const peakData = data?.peakHours.map((min, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    minutes: min,
  })) || [];

  const s = {
    card: { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px' } as React.CSSProperties,
    title: { fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' } as React.CSSProperties,
    stat: { display: 'flex', alignItems: 'center', gap: '16px' } as React.CSSProperties,
    statIcon: { width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
    statNum: { fontSize: '28px', fontWeight: 800, lineHeight: 1 } as React.CSSProperties,
    statLabel: { fontSize: '12px', color: 'var(--text-muted)' } as React.CSSProperties,
    statSub: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' } as React.CSSProperties,
  };

  const exportCsv = () => {
    window.open('/api/analytics/export', '_blank');
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BarChart3 size={24} /> Analytics
        </h1>
        <button onClick={exportCsv} style={{ 
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', 
          padding: '8px 16px', borderRadius: '8px', color: 'var(--text-primary)',
          display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px'
        }}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={s.card}>
          <div style={s.stat}>
            <div style={{ ...s.statIcon, background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)' }}><Target size={24} /></div>
            <div>
              <div style={s.statNum}>{data?.recentPomodoros || 0}</div>
              <div style={s.statLabel}>Pomodoros (30d)</div>
              <div style={s.statSub}>{data?.totalPomodoros || 0} all time</div>
            </div>
          </div>
        </div>
        <div style={s.card}>
          <div style={s.stat}>
            <div style={{ ...s.statIcon, background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-success)' }}><Clock size={24} /></div>
            <div>
              <div style={s.statNum}>{recentHours}h</div>
              <div style={s.statLabel}>Focus (30d)</div>
              <div style={s.statSub}>{totalHours}h all time</div>
            </div>
          </div>
        </div>
        <div style={s.card}>
          <div style={s.stat}>
            <div style={{ ...s.statIcon, background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-warning)' }}><Flame size={24} /></div>
            <div>
              <div style={s.statNum}>{data?.uniqueDaysLast7d || 0}/7</div>
              <div style={s.statLabel}>Days Active</div>
              <div style={s.statSub}>last 7 days</div>
            </div>
          </div>
        </div>
        <div style={s.card}>
          <div style={s.stat}>
            <div style={{ ...s.statIcon, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-info)' }}><Calendar size={24} /></div>
            <div>
              <div style={s.statNum}>{data?.dailyAvgMinutes || 0}m</div>
              <div style={s.statLabel}>Daily Average</div>
              <div style={s.statSub}>last 30 days</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={s.card}>
          <div style={s.title}><Zap size={14} /> Time by Habit (Last 30 Days)</div>
          {data?.timeByHabit && data.timeByHabit.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Pie data={data.timeByHabit} dataKey="minutes" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} label={((props: any) => `${props.name}: ${Math.round(props.minutes)}m`) as any} labelLine={false} style={{ fontSize: '11px' }}>
                  {data.timeByHabit.map((h, i) => <Cell key={i} fill={h.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px' }}>No data in the last 30 days</p>}
        </div>

        <div style={s.card}>
          <div style={s.title}><TrendingUp size={14} /> Peak Hours (Last 30 Days)</div>
          {data?.peakHours && data.peakHours.some(h => h > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={peakData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="minutes" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Complete some pomodoros to see your peak hours</p>}
        </div>
      </div>

      <div style={s.card}>
        <div style={s.title}><Flame size={14} /> Focus History (Last 14 Days)</div>
        {data?.heatmap && Object.keys(data.heatmap).length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart 
              data={Array.from({ length: 14 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (13 - i));
                const key = d.toISOString().split('T')[0];
                return {
                  date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  minutes: data.heatmap[key] || 0
                };
              })}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '12px' }} 
                itemStyle={{ color: 'var(--accent-primary)', fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="minutes" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorMinutes)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px' }}>No activity data yet</p>}
      </div>
    </div>
  );
}
