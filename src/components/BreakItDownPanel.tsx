'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronRight, Sparkles, RefreshCcw, CheckCircle2, WandSparkles, Loader2, Brain, Zap, Calendar } from 'lucide-react';
import styles from './BreakItDownPanel.module.css';

type Stage = 'idle' | 'generating' | 'generated' | 'refining' | 'approved';

type BreakdownNode = {
  title: string;
  description: string;
  pomodoroEstimate: number;
  dueDate?: string | null;
  children?: BreakdownNode[];
};

type PromptHistoryItem = {
  role: 'user';
  content: string;
  at: string;
};

type Habit = {
  id: string;
  name: string;
  emoji?: string;
  color: string;
};

type Props = {
  onTasksCreated?: () => void;
};

function collectExpandableIds(node: BreakdownNode, path = 'root', acc: string[] = []) {
  if (node.children && node.children.length > 0) {
    acc.push(path);
    node.children.forEach((child, index) => {
      collectExpandableIds(child, `${path}.${index}`, acc);
    });
  }
  return acc;
}

function collectLeafNodes(node: BreakdownNode): BreakdownNode[] {
  if (!node.children || node.children.length === 0) {
    return [node];
  }

  return node.children.flatMap((child) => collectLeafNodes(child));
}

function formatDueDate(dueDate: string | null | undefined): string | null {
  if (!dueDate) return null;
  const date = new Date(dueDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return 'Hoy';
  if (date.getTime() === tomorrow.getTime()) return 'Mañana';
  return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function BreakItDownPanel({ onTasksCreated }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<PromptHistoryItem[]>([]);
  const [tree, setTree] = useState<BreakdownNode | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<'deepseek-chat' | 'deepseek-reasoner'>('deepseek-chat');

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  const leafNodes = useMemo(() => (tree ? collectLeafNodes(tree) : []), [tree]);

  useEffect(() => {
    if (!showApproveModal) {
      return;
    }

    let cancelled = false;

    const fetchHabits = async () => {
      const response = await fetch('/api/habits');
      if (!response.ok || cancelled) {
        return;
      }
      const data = (await response.json()) as Habit[];
      if (!cancelled) {
        setHabits(data);
        setSelectedHabitId((current) => current || data[0]?.id || '');
      }
    };

    void fetchHabits();

    return () => {
      cancelled = true;
    };
  }, [showApproveModal]);

  const toggleExpand = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const generateBreakdown = async (options?: { regenerate?: boolean }) => {
    const activePrompt = prompt.trim();
    const fallbackPrompt = history[0]?.content || '';
    const finalPrompt = options?.regenerate ? (activePrompt || fallbackPrompt) : activePrompt;

    if (!finalPrompt) {
      setError('Describe the complex task first.');
      return;
    }

    setError(null);
    setStage(tree && !options?.regenerate ? 'refining' : 'generating');

    const promptEntry: PromptHistoryItem = {
      role: 'user',
      content: finalPrompt,
      at: new Date().toISOString(),
    };

    const nextHistory = [...history, promptEntry];
    setHistory(nextHistory);

    try {
      const response = await fetch('/api/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          history: nextHistory.map((item) => ({ role: item.role, content: item.content })),
          currentTree: options?.regenerate ? undefined : tree,
          model: selectedModel,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate breakdown');
      }

      const nextTree = data.tree as BreakdownNode;
      setTree(nextTree);
      setSessionId(data.sessionId as string);
      setExpandedIds(new Set(collectExpandableIds(nextTree)));
      setStage('generated');
      setPrompt('');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Failed to generate breakdown';
      setError(message);
      setStage(tree ? 'generated' : 'idle');
    }
  };

  const handleApprove = async () => {
    if (!sessionId || !selectedHabitId) {
      return;
    }

    setError(null);
    setIsSubmittingApproval(true);

    try {
      const response = await fetch('/api/breakdown/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, habitId: selectedHabitId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve and create tasks');
      }

      setStage('approved');
      setShowApproveModal(false);
      onTasksCreated?.();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Failed to approve and create tasks';
      setError(message);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const canRefine = stage === 'generated' || stage === 'approved';
  const canApprove = !!tree && !!sessionId && (stage === 'generated' || stage === 'approved');
  const isBusy = stage === 'generating' || stage === 'refining';

  const renderNode = (node: BreakdownNode, id: string, depth = 0) => {
    const hasChildren = !!node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(id);
    const isHovered = hoveredId === id;
    const dueLabel = formatDueDate(node.dueDate);

    return (
      <li key={id}>
        <div
          className={`${styles.treeNodeRow} ${isHovered ? styles.treeNodeRowHover : ''}`}
          style={{ '--node-depth': depth } as CSSProperties}
          onMouseEnter={() => setHoveredId(id)}
          onMouseLeave={() => setHoveredId((current) => (current === id ? null : current))}
        >
          {hasChildren ? (
            <button className={styles.expandBtn} onClick={() => toggleExpand(id)}>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className={styles.leafMarker} />
          )}

          <div className={styles.nodeBody}>
            <div className={styles.nodeTopLine}>
              <strong>{node.title}</strong>
              <span className={styles.nodeBadges}>
                {dueLabel && (
                  <span className={styles.dueBadge}>
                    <Calendar size={10} />
                    {dueLabel}
                  </span>
                )}
                <span className={styles.pomBadge}>{node.pomodoroEstimate} 🍅</span>
              </span>
            </div>
            <p>{node.description}</p>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <ul className={styles.treeChildren}>
            {node.children?.map((child, index) => renderNode(child, `${id}.${index}`, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className={styles.shell}>
      <div className={styles.leftPanel}>
        <div className={styles.panelHeader}>
          <h2>Break It Down</h2>
          <p>Turn one complex task into an actionable plan in under a minute.</p>
        </div>

        <div className={styles.topControls}>
          <div className={styles.stateChipWrap}>
            <span className={`${styles.stateChip} ${styles[`state${stage[0].toUpperCase()}${stage.slice(1)}`]}`}>
              {stage.toUpperCase()}
            </span>
          </div>

          <div className={styles.modelSelector}>
            <button
              className={`${styles.modelBtn} ${selectedModel === 'deepseek-chat' ? styles.modelBtnActive : ''}`}
              onClick={() => setSelectedModel('deepseek-chat')}
              title="Fast & efficient"
            >
              <Zap size={12} />
              Chat
            </button>
            <button
              className={`${styles.modelBtn} ${selectedModel === 'deepseek-reasoner' ? styles.modelBtnActive : ''}`}
              onClick={() => setSelectedModel('deepseek-reasoner')}
              title="Deep reasoning, better for complex tasks"
            >
              <Brain size={12} />
              Reasoner
            </button>
          </div>
        </div>

        <div className={styles.promptBox}>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Example: Launch my personal portfolio website with a clear case-study page and contact funnel"
            rows={4}
          />

          <button
            className={styles.generateBtn}
            onClick={() => generateBreakdown()}
            disabled={isBusy}
          >
            {isBusy ? (
              <>
                <Loader2 size={15} className={styles.spin} />
                {selectedModel === 'deepseek-reasoner' ? 'Reasoning...' : 'Generating'}
              </>
            ) : (
              <>
                <Sparkles size={15} />
                {tree ? 'Refine Breakdown' : 'Generate Breakdown'}
              </>
            )}
          </button>
        </div>

        <div className={styles.actionsRow}>
          <button
            className={styles.actionBtn}
            onClick={() => generateBreakdown()}
            disabled={!canRefine || isBusy}
          >
            <WandSparkles size={14} />
            Refine
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => generateBreakdown({ regenerate: true })}
            disabled={!tree || isBusy}
          >
            <RefreshCcw size={14} />
            Regenerate
          </button>
          <button className={styles.approveBtn} onClick={() => setShowApproveModal(true)} disabled={!canApprove}>
            <CheckCircle2 size={14} />
            Approve & Create Tasks
          </button>
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <div className={styles.historyBox}>
          <h3>Prompt History</h3>
          {history.length === 0 ? (
            <p className={styles.emptyText}>Your prompts appear here as you iterate.</p>
          ) : (
            <ul>
              {history.map((item) => (
                <li key={`${item.at}-${item.content.slice(0, 18)}`}>
                  <span>{new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <p>{item.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.panelHeader}>
          <h2>Task Tree</h2>
          <p>Collapsible plan from root objective to actionable leaf tasks.</p>
        </div>

        {!tree ? (
          <div className={styles.treeEmpty}>
            <p>Your visual tree will appear here after generation.</p>
          </div>
        ) : (
          <ul className={styles.treeRoot}>{renderNode(tree, 'root')}</ul>
        )}
      </div>

      {showApproveModal && (
        <div className={styles.modalOverlay} onClick={() => setShowApproveModal(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Confirm Task Creation</h3>
              <p>Only leaf tasks will be created and assigned to one habit.</p>
            </div>

            <label className={styles.modalLabel} htmlFor="breakdown-habit-selector">
              Select Habit
            </label>
            <select
              id="breakdown-habit-selector"
              className={styles.modalSelect}
              value={selectedHabitId}
              onChange={(event) => setSelectedHabitId(event.target.value)}
            >
              {habits.map((habit) => (
                <option key={habit.id} value={habit.id}>
                  {habit.emoji || '📚'} {habit.name}
                </option>
              ))}
            </select>

            <div className={styles.leafList}>
              {leafNodes.map((leaf, index) => (
                <div key={`${leaf.title}-${index}`} className={styles.leafItem}>
                  <strong>{leaf.title}</strong>
                  <p>{leaf.description}</p>
                  <div className={styles.leafMeta}>
                    <span>{leaf.pomodoroEstimate} pomodoros</span>
                    {leaf.dueDate && (
                      <span className={styles.leafDueDate}>
                        <Calendar size={10} />
                        {formatDueDate(leaf.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowApproveModal(false)}>
                Cancel
              </button>
              <button
                className={styles.modalConfirm}
                onClick={handleApprove}
                disabled={!selectedHabitId || isSubmittingApproval}
              >
                {isSubmittingApproval ? 'Creating...' : 'Confirm & Create Tasks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
