'use client';

import { useState, useEffect } from 'react';

export default function TimerPopupPage() {
  const [time, setTime] = useState('--:--');
  const [title, setTitle] = useState('No active session');
  const [phase, setPhase] = useState<'focus' | 'break' | 'idle'>('idle');

  useEffect(() => {
    const update = () => {
      try {
        const raw = localStorage.getItem('eu-focus-timer');
        if (!raw) {
          setTime('--:--');
          setTitle('No active session');
          setPhase('idle');
          return;
        }
        const data = JSON.parse(raw);
        const now = Date.now();
        const elapsed = Math.floor((now - data.startTimestamp) / 1000);
        const remaining = Math.max(0, data.totalTime - elapsed);
        const m = Math.floor(remaining / 60).toString().padStart(2, '0');
        const s = (remaining % 60).toString().padStart(2, '0');
        setTime(`${m}:${s}`);
        setTitle(data.taskTitle || 'Focus session');
        setPhase(data.phase);
      } catch {
        setTime('--:--');
        setTitle('No active session');
        setPhase('idle');
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const color = phase === 'focus' ? '#58cc02' : phase === 'break' ? '#1cb0f6' : '#8892b0';

  return (
    <div style={{
      background: '#0f1320',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      margin: 0,
      padding: 0,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 56,
          fontWeight: 900,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.04em',
          color,
          textShadow: phase !== 'idle' ? `0 0 24px ${color}40` : 'none',
          lineHeight: 1,
          marginBottom: 8,
        }}>
          {time}
        </div>
        <div style={{
          fontSize: 13,
          color: '#8892b0',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 260,
          margin: '0 auto',
          fontWeight: 600,
        }}>
          {title}
        </div>
      </div>
    </div>
  );
}
