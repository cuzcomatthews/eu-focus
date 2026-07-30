'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Clock, Timer, CalendarCheck, ListChecks } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications');
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readAll: true }),
    });
    fetchNotifications();
  };

  const markRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchNotifications();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'pomodoro_complete': return <Timer size={16} />;
      case 'task_reminder': return <CalendarCheck size={16} />;
      case 'schedule_reminder': return <CalendarCheck size={16} />;
      case 'habit_reminder': return <ListChecks size={16} />;
      default: return <Bell size={16} />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'pomodoro_complete': return { bg: 'rgba(88,204,2,0.12)', color: '#58cc02' };
      case 'task_reminder': return { bg: 'rgba(28,176,246,0.12)', color: '#1cb0f6' };
      case 'schedule_reminder': return { bg: 'rgba(255,150,0,0.12)', color: '#ff9600' };
      case 'habit_reminder': return { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' };
      default: return { bg: 'rgba(100,116,139,0.12)', color: '#9B9A97' };
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Bell size={24} /> Notifications
          {unreadCount > 0 && (
            <span style={{
              background: 'var(--accent-danger)',
              color: 'white',
              fontSize: '12px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '999px',
            }}>
              {unreadCount}
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-secondary)',
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : notifications.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: 'var(--text-muted)',
        }}>
          <Bell size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <p style={{ fontSize: '16px', fontWeight: 600 }}>No notifications yet</p>
          <p style={{ fontSize: '13px', marginTop: '8px' }}>
            Complete a pomodoro or enable reminders to see them here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notifications.map((n) => {
            const colors = getColor(n.type);
            return (
              <div
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                style={{
                  background: n.read ? 'var(--bg-card)' : 'rgba(99,102,241,0.06)',
                  border: `1px solid ${n.read ? 'var(--border-subtle)' : 'rgba(99,102,241,0.2)'}`,
                  borderRadius: '14px',
                  padding: '14px 18px',
                  cursor: n.read ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: colors.bg,
                  color: colors.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {getIcon(n.type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: colors.color,
                      background: colors.bg,
                      padding: '2px 8px',
                      borderRadius: '999px',
                    }}>
                      {n.type.replace(/_/g, ' ')}
                    </span>
                    {!n.read && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--accent-primary)',
                        flexShrink: 0,
                      }} />
                    )}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {n.body}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} />
                    {new Date(n.createdAt).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
