'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle2, XCircle, Ban, Loader2, Send, BarChart3, Mic, RefreshCw, Clock } from 'lucide-react';
import { getTodayString, getGuayaquilDayOfWeek, getDateForDayOfWeek, getDateOfWeekOfDay } from '@/lib/timezone';
import MicButton from '@/components/MicButton';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import schedStyles from './schedule.module.css';
import { isAdvancedUser } from '@/lib/featureGating';

interface ScheduleBlock {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  category: string;
  label: string | null;
}

interface DailyLog {
  id: string;
  date: string;
  scheduleBlockId: string | null;
  startTime: string;
  endTime: string;
  category: string;
  label: string | null;
  status: string;
  missedReason: string | null;
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const CATEGORIES: Record<string, { label: string; color: string }> = {
  work: { label: 'Trabajo', color: '#6366f1' },
  class: { label: 'Clase', color: '#1cb0f6' },
  ocio: { label: 'Ocio', color: '#ff9600' },
  comida: { label: 'Comida', color: '#58cc02' },
};

export default function SchedulePage() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session && !isAdvancedUser(session.user?.email)) {
      router.replace('/dashboard');
    }
  }, [session, router]);

  if (!session || !isAdvancedUser(session.user?.email)) return null;

  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => getTodayString());
  const [selectedDay, setSelectedDay] = useState(() => getGuayaquilDayOfWeek());
  const [statusModal, setStatusModal] = useState<{ block: ScheduleBlock; log?: DailyLog } | null>(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUpdateMsg, setAiUpdateMsg] = useState('');
  const [aiUpdateLoading, setAiUpdateLoading] = useState(false);
  const [aiUpdateResult, setAiUpdateResult] = useState('');
  const [stats, setStats] = useState<{ hoursCompleted: number; hoursMissed: number; totalCompleted: number; totalMissed: number } | null>(null);

  const fetchSchedule = useCallback(async () => {
    const res = await fetch('/api/schedule');
    if (res.ok) {
      const data = await res.json();
      setBlocks(data.blocks || []);
    }
  }, []);

  const fetchDailyLogs = useCallback(async (date: string) => {
    const res = await fetch(`/api/schedule/daily?date=${date}`);
    if (res.ok) {
      const data = await res.json();
      setDailyLogs(data.logs || []);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    const today = getTodayString();
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const sevenDaysAgo = getTodayString(d);
    const res = await fetch(`/api/schedule/stats?from=${sevenDaysAgo}&to=${today}`);
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  }, []);

  useEffect(() => { fetchSchedule(); fetchStats(); }, [fetchSchedule, fetchStats]);
  useEffect(() => { fetchDailyLogs(selectedDate); setSelectedDay(getGuayaquilDayOfWeek(new Date(selectedDate + 'T12:00:00'))); }, [selectedDate, fetchDailyLogs]);

  const saveBlockStatus = async (status: string, missedReason?: string) => {
    if (!statusModal) return;
    const { block } = statusModal;
    await fetch('/api/schedule/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: selectedDate,
        blocks: [{ scheduleBlockId: block.id, startTime: block.startTime, endTime: block.endTime, category: block.category, label: block.label, status, missedReason: missedReason || null }],
      }),
    });
    setStatusModal(null);
    fetchDailyLogs(selectedDate);
    fetchStats();
  };

  const sendAiUpdate = async () => {
    const msg = aiUpdateMsg.trim();
    if (!msg || aiUpdateLoading) return;
    setAiUpdateLoading(true);
    setAiUpdateResult('');
    try {
      const res = await fetch('/api/schedule/ai-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, date: selectedDate }),
      });
      const data = await res.json();
      setAiUpdateResult(data.message || data.error || 'Ok');
      setAiUpdateMsg('');
      fetchDailyLogs(selectedDate);
      fetchStats();
    } catch {
      setAiUpdateResult('Error de conexión.');
    } finally {
      setAiUpdateLoading(false);
    }
  };

  const askAI = async (question?: string) => {
    const q = question || aiQuestion;
    if (!q) return;
    setAiLoading(true);
    setAiAnswer('');
    const res = await fetch('/api/schedule/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) });
    if (res.ok) { const data = await res.json(); setAiAnswer(data.answer || ''); }
    setAiLoading(false);
  };

  const dayBlocks = blocks.filter(b => b.dayOfWeek === selectedDay);
  const todayDate = getTodayString();

  const getBlockStatus = (block: ScheduleBlock) => dailyLogs.find(l => l.scheduleBlockId === block.id || (l.startTime === block.startTime && l.endTime === block.endTime));

  const fm = (t: string) => t.substring(0, 5);

  const s: Record<string, React.CSSProperties> = {
    card: { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '16px', marginBottom: '12px' },
    h2: { fontSize: '15px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' },
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={22} /> Horario
        </h1>
        <button
          onClick={() => { fetchSchedule(); fetchDailyLogs(selectedDate); fetchStats(); }}
          style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={12} /> Refrescar
        </button>
      </div>

      <div className={schedStyles.layout}>
        {/* LEFT COLUMN */}
        <div>
          {/* Day selector */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
            {DAYS.map((day, i) => (
              <button
                key={i}
                onClick={() => setSelectedDate(getDateForDayOfWeek(i))}
                style={{
                  flex: 1, minWidth: 0, padding: '8px 4px', borderRadius: '10px',
                  border: selectedDay === i ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: selectedDay === i ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
                  color: selectedDay === i ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '11px', fontWeight: selectedDay === i ? 700 : 500, cursor: 'pointer', textAlign: 'center',
                }}
              >
                <div style={{ opacity: 0.7 }}>{day}</div>
                <div style={{ fontSize: '15px', marginTop: '2px' }}>{getDateOfWeekOfDay(i)}</div>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '13px' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {selectedDate === todayDate ? 'Hoy' : `${selectedDay} - ${selectedDate}`}
            </span>
          </div>

          {/* Block list */}
          {dayBlocks.length === 0 ? (
            <div style={{ ...s.card, textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
              Sin bloques para este día. Refresca para cargar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
              {dayBlocks.map((block) => {
                const cat = CATEGORIES[block.category] || { label: block.category, color: '#9B9A97' };
                const log = getBlockStatus(block);
                const st = log?.status;
                return (
                  <div
                    key={block.id}
                    onClick={() => setStatusModal({ block, log })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px',
                      background: st === 'completed' ? 'rgba(88,204,2,0.05)' : st === 'missed' ? 'rgba(239,68,68,0.05)' : st === 'canceled' ? 'rgba(100,116,139,0.05)' : 'var(--bg-card)',
                      border: `1px solid ${st === 'completed' ? 'rgba(88,204,2,0.2)' : st === 'missed' ? 'rgba(239,68,68,0.2)' : st === 'canceled' ? 'rgba(100,116,139,0.12)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer', transition: 'all 0.12s ease',
                    }}
                  >
                    <div style={{ width: '4px', height: '28px', borderRadius: '2px', background: cat.color, flexShrink: 0 }} />
                    <div style={{ minWidth: '32px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                      <Clock size={11} style={{ marginRight: 2, verticalAlign: -1 }} />
                      {fm(block.startTime)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {block.label || cat.label}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {st === 'completed' && <CheckCircle2 size={16} color="#58cc02" />}
                      {st === 'missed' && <XCircle size={16} color="#ef4444" />}
                      {st === 'canceled' && <Ban size={16} color="#9B9A97" />}
                      {!st && <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--border-default)' }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* AI Update input */}
          <div style={s.card}>
            <div style={s.h2}><Mic size={14} /> Actualizar con IA</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <input
                value={aiUpdateMsg}
                onChange={(e) => setAiUpdateMsg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendAiUpdate()}
                placeholder="De 8 a 11 hice tesis, 11 a 11:30 jugué..."
                style={{ flex: 1, minWidth: '140px', padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '12px' }}
              />
              <MicButton onTranscription={(t) => setAiUpdateMsg(p => p + (p ? ' ' : '') + t)} />
              <button onClick={sendAiUpdate} disabled={aiUpdateLoading || !aiUpdateMsg.trim()}
                style={{ padding: '9px 14px', borderRadius: '10px', background: 'var(--gradient-primary)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                {aiUpdateLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
                Enviar
              </button>
            </div>
            {aiUpdateResult && (
              <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', background: aiUpdateResult.includes('Error') ? 'rgba(239,68,68,0.08)' : 'rgba(88,204,2,0.08)', color: aiUpdateResult.includes('Error') ? '#ef4444' : '#58cc02', fontSize: '12px', fontWeight: 600 }}>
                {aiUpdateResult}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {/* Stats */}
          {stats && (
            <div style={s.card}>
              <div style={s.h2}><BarChart3 size={14} /> Esta semana</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, background: 'rgba(88,204,2,0.06)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#58cc02' }}>{stats.hoursCompleted}h</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>cumplidas</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(239,68,68,0.06)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#ef4444' }}>{stats.hoursMissed}h</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>perdidas</div>
                </div>
              </div>
            </div>
          )}

          {/* AI Chat */}
          <div style={s.card}>
            <div style={s.h2}><BarChart3 size={14} /> Análisis IA</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {['¿Cómo estuvo mi semana?', '¿En qué pierdo más tiempo?', '¿Estoy mejorando?', '¿Cuántas horas trabajé?'].map(q => (
                <button key={q} onClick={() => askAI(q)} disabled={aiLoading}
                  style={{ padding: '5px 10px', borderRadius: '999px', border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.06)', color: 'var(--text-primary)', fontSize: '11px', cursor: 'pointer' }}>
                  {q}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input value={aiQuestion} onChange={e => setAiQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askAI()}
                placeholder="Pregunta algo..."
                style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '12px' }} />
              <button onClick={() => askAI()} disabled={aiLoading}
                style={{ padding: '8px 14px', borderRadius: '10px', background: 'var(--gradient-primary)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                <Send size={13} />
              </button>
            </div>
            {aiAnswer && (
              <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: '10px', fontSize: '12px', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                {aiAnswer}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Modal */}
      {statusModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setStatusModal(null)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px', minWidth: '280px', maxWidth: '90vw' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>
              {statusModal.block.label || CATEGORIES[statusModal.block.category]?.label} ({fm(statusModal.block.startTime)}–{fm(statusModal.block.endTime)})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button onClick={() => saveBlockStatus('completed')} style={btnStyle('#58cc02', 'rgba(88,204,2,0.08)')}>
                <CheckCircle2 size={16} /> Cumplido
              </button>
              <button onClick={() => saveBlockStatus('missed', 'videojuegos')} style={btnStyle('#ef4444', 'rgba(239,68,68,0.06)')}>❌ Videojuegos</button>
              <button onClick={() => saveBlockStatus('missed', 'redes_sociales')} style={btnStyle('#ef4444', 'rgba(239,68,68,0.06)')}>❌ Redes Sociales</button>
              <button onClick={() => saveBlockStatus('missed', 'ocio_general')} style={btnStyle('#ef4444', 'rgba(239,68,68,0.06)')}>❌ Ocio General</button>
              <button onClick={() => saveBlockStatus('canceled')} style={btnStyle('#9B9A97', 'rgba(100,116,139,0.06)')}>
                <Ban size={16} /> Cancelado
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const btnStyle = (color: string, bg: string): React.CSSProperties => ({
  width: '100%', padding: '11px', borderRadius: '10px', border: `1px solid ${color}22`, background: bg,
  color, fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
});