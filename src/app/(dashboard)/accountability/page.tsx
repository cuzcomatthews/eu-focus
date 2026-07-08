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
} from 'lucide-react';
import styles from './accountability.module.css';
import { ACCOUNTABILITY_CATEGORIES, type HabitScores } from '@/lib/accountability';

type CheckInData = {
  id: string;
  rawText: string;
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
  orden_cuarto: '#14b8a6',
  tesis: '#f59e0b',
  proyectos: '#3b82f6',
  dopamina: '#ef4444',
};

const QUICK_PROMPTS = [
  '¿Cómo me fue esta semana?',
  '¿Cuál fue mi mejor día del mes?',
  '¿Cómo estoy con la tesis?',
  '¿He mejorado mi sueño?',
  'Resumen del último mes',
];

function getScoreColor(score: number | null): string {
  if (score === null) return 'var(--text-muted)';
  if (score >= 80) return 'var(--accent-success)';
  if (score >= 50) return 'var(--accent-warning)';
  return 'var(--accent-danger)';
}

export default function AccountabilityPage() {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayData, setTodayData] = useState<CheckInData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyRange, setHistoryRange] = useState<'week' | 'month' | 'all'>('week');
  const [queryQuestion, setQueryQuestion] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchToday = useCallback(async () => {
    try {
      const res = await fetch('/api/accountability/checkin');
      if (res.ok) {
        const data = await res.json();
        setTodayData(data);
      }
    } catch {
      // silent
    }
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
    } catch {
      // silent
    }
  }, [historyRange]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.getTime() === today.getTime()) return 'Hoy';
    if (d.getTime() === yesterday.getTime()) return 'Ayer';
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  };

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
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={isSubmitting || !text.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className={styles.submitBtnSpinner} />
                Analizando...
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Enviar Check-in
              </>
            )}
          </button>
        </div>

        {error && (
          <p style={{ color: 'var(--accent-danger)', fontSize: '13px', marginTop: '12px' }}>{error}</p>
        )}
      </div>

      {/* Two Column: Feedback + Scores */}
      <div className={styles.contentGrid}>
        {/* Feedback */}
        <div className={styles.feedbackCard}>
          <div className={styles.feedbackHeader}>
            <div className={styles.feedbackAvatar}>
              <Sparkles size={18} />
            </div>
            <div>
              <div className={styles.feedbackLabel}>Tu Coach</div>
            </div>
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

        {/* Habit Scores */}
        <div className={styles.scoresCard}>
          <div className={styles.scoresHeader}>Salud de Hábitos — Hoy</div>

          {todayData ? (
            ACCOUNTABILITY_CATEGORIES.map((cat) => {
              const h = (todayData.habitScores as HabitScores)[cat.key];
              const score = h?.score ?? null;
              return (
                <div key={cat.key} className={styles.scoreRow}>
                  <span className={styles.scoreEmoji}>{cat.emoji}</span>
                  <div className={styles.scoreInfo}>
                    <div className={styles.scoreLabel}>{cat.label}</div>
                    <div className={styles.scoreBarWrap}>
                      <div
                        className={styles.scoreBarFill}
                        style={{
                          width: `${score ?? 0}%`,
                          background: score !== null
                            ? `linear-gradient(90deg, ${SCORE_COLORS[cat.key] || 'var(--accent-primary)'}, ${SCORE_COLORS[cat.key] || 'var(--accent-primary)'}88)`
                            : 'transparent',
                        }}
                      />
                    </div>
                    {h?.notes && <div className={styles.scoreNotes}>{h.notes}</div>}
                  </div>
                  {score !== null ? (
                    <span className={styles.scoreValue} style={{ color: getScoreColor(score) }}>
                      {score}%
                    </span>
                  ) : (
                    <span className={styles.scoreNoData}>—</span>
                  )}
                </div>
              );
            })
          ) : (
            <div className={styles.scoresEmpty}>
              <BarChart3 size={40} className={styles.feedbackEmptyIcon} />
              <span>Sin datos de hoy todavía</span>
            </div>
          )}
        </div>
      </div>

      {/* Query Section */}
      <div className={styles.querySection}>
        <div className={styles.queryHeader}>
          <TrendingUp size={16} color="var(--accent-warning)" />
          <span className={styles.queryHeaderTitle}>Consultar mi historial</span>
        </div>

        <div className={styles.quickPrompts}>
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              className={styles.quickPromptBtn}
              onClick={() => handleQuery(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className={styles.queryInputRow}>
          <input
            className={styles.queryInput}
            value={queryQuestion}
            onChange={(e) => setQueryQuestion(e.target.value)}
            placeholder="Ej: ¿Cómo me fue en la tesis este mes?"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuery();
              }
            }}
          />
          <button
            className={styles.queryAskBtn}
            onClick={() => handleQuery()}
            disabled={isQuerying || !queryQuestion.trim()}
          >
            {isQuerying ? (
              <Loader2 size={14} className={styles.submitBtnSpinner} />
            ) : (
              <Send size={14} />
            )}
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
                  {ACCOUNTABILITY_CATEGORIES.map((cat) => {
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
    </div>
  );
}
