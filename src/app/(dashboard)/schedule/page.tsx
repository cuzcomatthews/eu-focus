'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle2, XCircle, Ban, TrendingUp, TrendingDown, Loader2, Send, BarChart3, Mic } from 'lucide-react';
import { getTodayString, getGuayaquilDayOfWeek, getDateForDayOfWeek, getDateOfWeekOfDay, getLabelForDayOfWeek } from '@/lib/timezone';
import MicButton from '@/components/MicButton';

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
const CATEGORIES: Record<string, { label: string; color: string; bg: string }> = {
  work: { label: 'Trabajo', color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  class: { label: 'Clase', color: '#1cb0f6', bg: 'rgba(28,176,246,0.15)' },
  ocio: { label: 'Ocio', color: '#ff9600', bg: 'rgba(255,150,0,0.15)' },
  comida: { label: 'Comida', color: '#58cc02', bg: 'rgba(88,204,2,0.15)' },
  ejercicio: { label: 'Ejercicio', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

const MISS_REASONS = [
  { value: 'videojuegos', label: 'Videojuegos' },
  { value: 'redes_sociales', label: 'Redes Sociales' },
  { value: 'ocio_general', label: 'Ocio General' },
];

export default function SchedulePage() {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => getTodayString());
  const [statusModal, setStatusModal] = useState<{ block: ScheduleBlock; log?: DailyLog } | null>(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [stats, setStats] = useState<{ hoursCompleted: number; hoursMissed: number; totalCompleted: number; totalMissed: number } | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => getGuayaquilDayOfWeek());
  const [predefinedQuestions] = useState([
    '¿Cómo estuvo mi semana?',
    '¿En qué pierdo más tiempo?',
    '¿Estoy mejorando?',
    '¿Cuántas horas trabajé vs perdí?',
  ]);
  const [aiUpdateMsg, setAiUpdateMsg] = useState('');
  const [aiUpdateLoading, setAiUpdateLoading] = useState(false);
  const [aiUpdateResult, setAiUpdateResult] = useState('');

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
    const today = new Date().toISOString().split('T')[0];
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
  useEffect(() => { fetchDailyLogs(selectedDate); setSelectedDay(getGuayaquilDayOfWeek()); }, [selectedDate, fetchDailyLogs]);

  const saveBlockStatus = async (status: string, missedReason?: string) => {
    if (!statusModal) return;
    const { block } = statusModal;

    await fetch('/api/schedule/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: selectedDate,
        blocks: [{
          scheduleBlockId: block.id,
          startTime: block.startTime,
          endTime: block.endTime,
          category: block.category,
          label: block.label,
          status,
          missedReason: missedReason || null,
        }],
      }),
    });

    setStatusModal(null);
    fetchDailyLogs(selectedDate);
    fetchStats();
  };

  const fillAllToday = async () => {
    const todayBlocks = blocks.filter(b => b.dayOfWeek === getGuayaquilDayOfWeek(new Date(selectedDate + 'T12:00:00')));
    await fetch('/api/schedule/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: selectedDate,
        blocks: todayBlocks.map(b => ({
          scheduleBlockId: b.id,
          startTime: b.startTime,
          endTime: b.endTime,
          category: b.category,
          label: b.label,
          status: 'completed',
        })),
      }),
    });
    fetchDailyLogs(selectedDate);
    fetchStats();
  };

  const askAI = async (question?: string) => {
    const q = question || aiQuestion;
    if (!q) return;
    setAiLoading(true);
    setAiAnswer('');

    const res = await fetch('/api/schedule/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q }),
    });

    if (res.ok) {
      const data = await res.json();
      setAiAnswer(data.answer || '');
    }
    setAiLoading(false);
  };

  const dayBlocks = blocks.filter(b => b.dayOfWeek === selectedDay);
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
      if (res.ok) {
        setAiUpdateResult(data.message || `Actualizado: ${data.updated}/${data.total} bloques.`);
        setAiUpdateMsg('');
        fetchDailyLogs(selectedDate);
        fetchStats();
      } else {
        setAiUpdateResult(data.error || 'Error al actualizar.');
      }
    } catch {
      setAiUpdateResult('Error de conexión.');
    } finally {
      setAiUpdateLoading(false);
    }
  };

  const todayDate = getTodayString();

  const getBlockStatus = (block: ScheduleBlock) => {
    return dailyLogs.find(l => l.scheduleBlockId === block.id || (l.startTime === block.startTime && l.endTime === block.endTime));
  };

  const formatTime = (t: string) => t.substring(0, 5);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Calendar size={24} /> Horario
      </h1>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px', background: 'rgba(88,204,2,0.08)', border: '1px solid rgba(88,204,2,0.2)', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#58cc02' }}>{stats.hoursCompleted}h</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>horas cumplidas</div>
          </div>
          <div style={{ flex: 1, minWidth: '140px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444' }}>{stats.hoursMissed}h</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>horas perdidas</div>
          </div>
          <div style={{ flex: 1, minWidth: '140px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#6366f1' }}>{stats.hoursCompleted + stats.hoursMissed || 0}h</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>total registrado</div>
          </div>
        </div>
      )}

      {/* Day selector */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {DAYS.map((day, i) => (
          <button
            key={i}
            onClick={() => {
              setSelectedDate(getDateForDayOfWeek(i));
            }}
            style={{
              flex: 1,
              minWidth: '44px',
              padding: '10px 6px',
              borderRadius: '12px',
              border: selectedDay === i ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              background: selectedDay === i ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
              color: selectedDay === i ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: selectedDay === i ? 700 : 500,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ fontSize: '10px', opacity: 0.7 }}>{day}</div>
            <div style={{ fontSize: '14px' }}>
              {getDateOfWeekOfDay(i)}
            </div>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{
            padding: '8px 14px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            color: 'var(--text-primary)',
            fontSize: '13px',
          }}
        />
        {selectedDate === todayDate && dayBlocks.length > 0 && (
          <button
            onClick={fillAllToday}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              background: 'var(--gradient-primary)',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle2 size={14} /> Marcar todo cumplido
          </button>
        )}
      </div>

      {/* AI Update */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '14px',
        padding: '14px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Mic size={14} /> Decile a la IA qué hiciste hoy
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={aiUpdateMsg}
            onChange={(e) => setAiUpdateMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendAiUpdate()}
            placeholder="Ej: De 8 a 11 trabajé en la tesis, de 11 a 11:30 jugué videojuegos, de 11:30 a 1 trabajé..."
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '10px 14px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}
          />
          <MicButton onTranscription={(text) => setAiUpdateMsg((prev) => prev + (prev ? ' ' : '') + text)} />
          <button
            onClick={sendAiUpdate}
            disabled={aiUpdateLoading || !aiUpdateMsg.trim()}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'var(--gradient-primary)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {aiUpdateLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
            {aiUpdateLoading ? '' : 'Enviar'}
          </button>
        </div>
        {aiUpdateResult && (
          <div style={{
            marginTop: '8px',
            padding: '10px',
            borderRadius: '10px',
            background: aiUpdateResult.includes('Error') ? 'rgba(239,68,68,0.08)' : 'rgba(88,204,2,0.08)',
            color: aiUpdateResult.includes('Error') ? '#ef4444' : '#58cc02',
            fontSize: '12px',
            fontWeight: 600,
          }}>
            {aiUpdateResult}
          </div>
        )}
      </div>

      {/* Day blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
        {dayBlocks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
            Sin bloques para este día.
          </div>
        ) : (
          dayBlocks.map((block) => {
            const cat = CATEGORIES[block.category] || { label: block.category, color: '#9B9A97', bg: 'rgba(100,116,139,0.1)' };
            const log = getBlockStatus(block);
            return (
              <div
                key={block.id}
                onClick={() => setStatusModal({ block, log })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: log?.status === 'completed' ? 'rgba(88,204,2,0.06)' : log?.status === 'missed' ? 'rgba(239,68,68,0.06)' : log?.status === 'canceled' ? 'rgba(100,116,139,0.06)' : 'var(--bg-card)',
                  border: `1px solid ${log?.status === 'completed' ? 'rgba(88,204,2,0.2)' : log?.status === 'missed' ? 'rgba(239,68,68,0.2)' : log?.status === 'canceled' ? 'rgba(100,116,139,0.15)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatTime(block.startTime)}
                  </div>
                  <div style={{
                    width: '4px',
                    height: '32px',
                    borderRadius: '2px',
                    background: cat.color,
                  }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {block.label || cat.label}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatTime(block.startTime)}–{formatTime(block.endTime)} · {cat.label}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {log?.status === 'completed' && <CheckCircle2 size={18} color="#58cc02" />}
                  {log?.status === 'missed' && <XCircle size={18} color="#ef4444" />}
                  {log?.status === 'canceled' && <Ban size={18} color="#9B9A97" />}
                  {!log && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>pendiente</span>}
                  {log?.missedReason && (
                    <span style={{
                      fontSize: '10px',
                      background: 'rgba(239,68,68,0.1)',
                      color: '#ef4444',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontWeight: 600,
                    }}>
                      {MISS_REASONS.find(r => r.value === log.missedReason)?.label || log.missedReason}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Status modal */}
      {statusModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => setStatusModal(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '20px',
              padding: '24px',
              minWidth: '300px',
              maxWidth: '90vw',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
              {statusModal.block.label || CATEGORIES[statusModal.block.category]?.label} ({formatTime(statusModal.block.startTime)}–{formatTime(statusModal.block.endTime)})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => saveBlockStatus('completed')} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(88,204,2,0.3)', background: 'rgba(88,204,2,0.08)', color: '#58cc02', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} /> Cumplido
              </button>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                <button onClick={() => saveBlockStatus('missed', 'videojuegos')} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: '4px' }}>
                  ❌ No cumplido — Videojuegos
                </button>
                <button onClick={() => saveBlockStatus('missed', 'redes_sociales')} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: '4px' }}>
                  ❌ No cumplido — Redes Sociales
                </button>
                <button onClick={() => saveBlockStatus('missed', 'ocio_general')} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: '4px' }}>
                  ❌ No cumplido — Ocio General
                </button>
              </div>
              <button onClick={() => saveBlockStatus('canceled')} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(100,116,139,0.3)', background: 'rgba(100,116,139,0.06)', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Ban size={18} /> Cancelado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px', marginTop: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={18} /> Análisis IA
        </h2>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {predefinedQuestions.map((q) => (
            <button
              key={q}
              onClick={() => askAI(q)}
              disabled={aiLoading}
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                border: '1px solid rgba(99,102,241,0.3)',
                background: 'rgba(99,102,241,0.08)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {q}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askAI()}
            placeholder="Pregunta algo sobre tu horario..."
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}
          />
          <button
            onClick={() => askAI()}
            disabled={aiLoading || !aiQuestion}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'var(--gradient-primary)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {aiLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
            {aiLoading ? '' : 'Ask'}
          </button>
        </div>
        {aiAnswer && (
          <div style={{
            marginTop: '12px',
            padding: '14px',
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: '12px',
            fontSize: '13px',
            lineHeight: '1.6',
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
          }}>
            {aiAnswer}
          </div>
        )}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
