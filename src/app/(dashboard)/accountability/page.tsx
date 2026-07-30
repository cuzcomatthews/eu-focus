'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  Sparkles,
  Loader2,
  Send,
  TrendingUp,
  BarChart3,
  Calendar,
  Mic,
  Plus,
  X,
} from 'lucide-react';
import styles from './accountability.module.css';
import MicButton from '@/components/MicButton';

type HabitCategory = {
  id: string;
  key: string;
  name: string;
  emoji: string;
  description: string;
  isDefault: boolean;
  sortOrder: number;
};

type HabitScore = { score: number | null; notes: string };
type HabitScores = Record<string, HabitScore>;

type CheckInData = {
  id: string;
  rawText?: string;
  habitScores: HabitScores;
  feedback: string;
  summary: string;
  date: string;
  isUpdate?: boolean;
};

type QueryResult = {
  answer: string;
  queryInterpretation: string;
  dataPoints: number;
  dateRange: { from: string; to: string };
};

type HistoryEntry = {
  id: string;
  date: string;
  rawText: string;
  habitScores: HabitScores;
  feedback: string;
  summary: string;
};

const SCORE_COLORS: Record<string, string> = {
  sueño: '#8b5cf6',
  organizacion: '#14b8a6',
  academico: '#f59e0b',
  proyectos: '#3b82f6',
  dopamina: '#ef4444',
};

const QUICK_PROMPTS = [
  '¿Cómo me fue esta semana?',
  '¿Cuál fue mi mejor día del mes?',
  '¿Cómo estoy con académico?',
  '¿He mejorado mi sueño?',
  'Resumen del último mes',
];

function getScoreColor(score: number | null): string {
  if (score === null) return 'var(--text-muted)';
  if (score >= 80) return 'var(--accent-success)';
  if (score >= 50) return 'var(--accent-warning)';
  return 'var(--accent-danger)';
}

function getBarColor(key: string): string {
  return SCORE_COLORS[key] || '#6366f1';
}

export default function AccountabilityPage() {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayData, setTodayData] = useState<CheckInData | null>(null);
  const [habits, setHabits] = useState<HabitCategory[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyRange, setHistoryRange] = useState<'week' | 'month' | 'all'>('week');
  const [queryQuestion, setQueryQuestion] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showHabitModal, setShowHabitModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitEmoji, setNewHabitEmoji] = useState('📋');
  const [newHabitDesc, setNewHabitDesc] = useState('');
  const [isCreatingHabit, setIsCreatingHabit] = useState(false);

  const fetchToday = useCallback(async () => {
    try {
      const res = await fetch('/api/accountability/checkin');
      if (res.ok) {
        const data = await res.json();
        setTodayData(data);
      }
    } catch { /* silent */ }
  }, []);

  const fetchHabits = useCallback(async () => {
    try {
      const res = await fetch('/api/accountability/habits');
      if (res.ok) {
        const data = await res.json();
        setHabits(data);
      }
    } catch { /* silent */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const now = new Date();
      let from = new Date();
      if (historyRange === 'week') from.setDate(from.getDate() - 7);
      else if (historyRange === 'month') from.setDate(from.getDate() - 30);
      else from = new Date(0);

      const fromStr = from.toISOString().split('T')[0];
      const toStr = now.toISOString().split('T')[0];

      const res = await fetch(`/api/accountability/checkin?from=${fromStr}&to=${toStr}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
  }, [historyRange]);

  useEffect(() => { fetchToday(); fetchHabits(); }, [fetchToday, fetchHabits]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/accountability/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar');

      setTodayData(data);
      setText('');
      fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuery = async (question?: string) => {
    const q = question || queryQuestion.trim();
    if (!q) return;
    setError(null);
    setIsQuerying(true);
    setQueryResult(null);

    try {
      const res = await fetch('/api/accountability/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en la consulta');
      setQueryResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la consulta');
    } finally {
      setIsQuerying(false);
    }
  };

  const handleCreateHabit = async () => {
    if (!newHabitName.trim()) return;
    setIsCreatingHabit(true);
    try {
      const res = await fetch('/api/accountability/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newHabitName.trim(),
          emoji: newHabitEmoji,
          description: newHabitDesc.trim() || newHabitName.trim(),
        }),
      });
      if (res.ok) {
        setShowHabitModal(false);
        setNewHabitName('');
        setNewHabitEmoji('📋');
        setNewHabitDesc('');
        fetchHabits();
      }
    } catch { /* silent */ } finally {
      setIsCreatingHabit(false);
    }
  };

  const handleDeleteHabit = async (id: string) => {
    try {
      await fetch(`/api/accountability/habits?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      fetchHabits();
    } catch { /* silent */ }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const today = new Date();
    const opts: Intl.DateTimeFormatOptions = { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' };
    const dLocal = d.toLocaleDateString('es-EC', opts);
    const todayLocal = today.toLocaleDateString('es-EC');
    if (dLocal === todayLocal) return 'Hoy';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayLocal = yesterday.toLocaleDateString('es-EC');
    if (dLocal === yesterdayLocal) return 'Ayer';
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const EMOJI_OPTIONS = ['📋', '🏃', '💪', '🧘', '📖', '🎯', '💰', '❤️', '🎨', '🎵', '✍️', '🌱', '🧹', '🍽️', '💧', '📱', '🔇', '🚶', '🏋️', '🎮'];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Accountability</h1>
      </div>

      {/* Input Section */}
      <div className={styles.inputCard}>
        <div className={styles.inputHeader}>
          <Mic size={18} className={styles.inputHeaderIcon} />
          <span className={styles.inputHeaderTitle}>¿Qué hiciste hoy?</span>
        </div>

        <textarea
          className={styles.inputTextarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej: Hoy me levanté a las 7am, dormí bien. Avancé un capítulo de la tesis, pero no ordené el cuarto. No vi porno, aunque estuve mucho en redes sociales..."
          rows={4}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        <div className={styles.inputActions}>
          <span className={styles.inputHint}>
            <Calendar size={12} />
            Cuéntame cómo te fue hoy — la IA analiza tus hábitos automáticamente
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <MicButton onTranscription={(txt) => setText((prev: string) => prev + (prev ? ' ' : '') + txt)} />
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={isSubmitting || !text.trim()}
            >
              {isSubmitting ? (
                <><Loader2 size={15} className={styles.submitBtnSpinner} /> Analizando...</>
              ) : (
                <><Sparkles size={15} /> Enviar Check-in</>
              )}
            </button>
          </div>
        </div>

        {error && <p style={{ color: 'var(--accent-danger)', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
      </div>

      {/* Health Scores */}
      <div className={styles.scoresCard}>
        <div className={styles.scoresHeaderRow}>
          <span className={styles.scoresHeader}>Salud de Hábitos — Hoy</span>
          <button className={styles.addHabitBtn} onClick={() => setShowHabitModal(true)} title="Agregar hábito personalizado">
            <Plus size={14} />
          </button>
        </div>

        {habits.length === 0 ? (
          <div className={styles.scoresEmpty}>
            <BarChart3 size={40} className={styles.feedbackEmptyIcon} />
            <span>Sin datos de hoy todavía</span>
          </div>
        ) : (
          habits.map((cat) => {
            const h = todayData ? (todayData.habitScores as HabitScores)[cat.key] : null;
            const score = h?.score ?? null;
            return (
              <div key={cat.key} className={styles.scoreRow}>
                <span className={styles.scoreEmoji}>{cat.emoji}</span>
                <div className={styles.scoreInfo}>
                  <div className={styles.scoreLabelRow}>
                    <span className={styles.scoreLabel}>{cat.name}</span>
                    {!cat.isDefault && (
                      <button
                        className={styles.deleteHabitBtn}
                        onClick={() => handleDeleteHabit(cat.id)}
                        title="Eliminar hábito"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  <div className={styles.scoreBarWrap}>
                    <div
                      className={styles.scoreBarFill}
                      style={{
                        width: `${score ?? 0}%`,
                        background: score !== null
                          ? `linear-gradient(90deg, ${getBarColor(cat.key)}, ${getBarColor(cat.key)}88)`
                          : 'transparent',
                      }}
                    />
                  </div>
                  {h?.notes && <div className={styles.scoreNotes}>{h.notes}</div>}
                </div>
                {score !== null ? (
                  <span className={styles.scoreValue} style={{ color: getScoreColor(score) }}>{score}%</span>
                ) : (
                  <span className={styles.scoreNoData}>—</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Coach Feedback */}
      <div className={styles.feedbackCard}>
        <div className={styles.feedbackHeader}>
          <div className={styles.feedbackAvatar}><Sparkles size={18} /></div>
          <div><div className={styles.feedbackLabel}>Tu Coach</div></div>
        </div>
        {todayData ? (
          <>
            <div className={styles.feedbackText}>{todayData.feedback}</div>
            <div className={styles.feedbackSummary}>{todayData.summary}</div>
            {todayData.isUpdate && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Actualizado — puedes seguir añadiendo más durante el día
              </div>
            )}
          </>
        ) : (
          <div className={styles.feedbackEmpty}>
            <MessageCircle size={40} className={styles.feedbackEmptyIcon} />
            <span>Escribe tu check-in diario para recibir feedback personalizado</span>
          </div>
        )}
      </div>

      {/* History */}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <span className={styles.chartTitle}>Historial de Check-ins</span>
          <div className={styles.chartRangeBtns}>
            {(['week', 'month', 'all'] as const).map((range) => (
              <button
                key={range}
                className={`${styles.chartRangeBtn} ${historyRange === range ? styles.chartRangeBtnActive : ''}`}
                onClick={() => setHistoryRange(range)}
              >
                {range === 'week' ? '7 días' : range === 'month' ? '30 días' : 'Todo'}
              </button>
            ))}
          </div>
        </div>
        {history.length === 0 ? (
          <div className={styles.chartEmpty}>Sin entradas en este período</div>
        ) : (
          <div className={styles.entryList}>
            {history.map((entry) => (
              <div key={entry.id} className={styles.entryItem}>
                <div className={styles.entryDate}>{formatDate(entry.date)}</div>
                <div className={styles.entrySummary}>{entry.summary}</div>
                <div className={styles.entryScores}>
                  {habits.map((cat) => {
                    const score = (entry.habitScores as HabitScores)[cat.key]?.score;
                    if (score === null || score === undefined) return null;
                    return (
                      <span key={cat.key} className={styles.entryScorePill}>
                        {cat.emoji} {score}%
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Query Section */}
      <div className={styles.querySection}>
        <div className={styles.queryHeader}>
          <TrendingUp size={16} color="var(--accent-warning)" />
          <span className={styles.queryHeaderTitle}>Consultar mi historial</span>
        </div>
        <div className={styles.quickPrompts}>
          {QUICK_PROMPTS.map((prompt) => (
            <button key={prompt} className={styles.quickPromptBtn} onClick={() => handleQuery(prompt)}>{prompt}</button>
          ))}
        </div>
        <div className={styles.queryInputRow}>
          <input
            className={styles.queryInput}
            value={queryQuestion}
            onChange={(e) => setQueryQuestion(e.target.value)}
            placeholder="Ej: ¿Cómo me fue en académico este mes?"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuery(); } }}
          />
          <button className={styles.queryAskBtn} onClick={() => handleQuery()} disabled={isQuerying || !queryQuestion.trim()}>
            {isQuerying ? <Loader2 size={14} className={styles.submitBtnSpinner} /> : <Send size={14} />}
            Preguntar
          </button>
        </div>
        {queryResult && (
          <>
            <div className={styles.queryAnswer}>{queryResult.answer}</div>
            <div className={styles.queryMeta}>
              <span>{queryResult.dataPoints} días analizados</span>
              <span>{queryResult.dateRange.from} → {queryResult.dateRange.to}</span>
            </div>
          </>
        )}
      </div>

      {/* Habit Creation Modal */}
      {showHabitModal && (
        <div className={styles.modalOverlay} onClick={() => setShowHabitModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>Nuevo Hábito Personalizado</span>
              <button className={styles.modalClose} onClick={() => setShowHabitModal(false)}><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Emoji</label>
                <div className={styles.emojiGrid}>
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      className={`${styles.emojiOption} ${newHabitEmoji === emoji ? styles.emojiOptionActive : ''}`}
                      onClick={() => setNewHabitEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Nombre</label>
                <input
                  className={styles.modalInput}
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  placeholder="Ej: Ejercicio, Meditación..."
                />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Descripción (para la IA)</label>
                <input
                  className={styles.modalInput}
                  value={newHabitDesc}
                  onChange={(e) => setNewHabitDesc(e.target.value)}
                  placeholder="Ej: Actividad física, cardio, gimnasio..."
                />
              </div>
              <button
                className={styles.submitBtn}
                onClick={handleCreateHabit}
                disabled={isCreatingHabit || !newHabitName.trim()}
                style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
              >
                {isCreatingHabit ? <><Loader2 size={15} className={styles.submitBtnSpinner} /> Creando...</> : 'Crear Hábito'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
