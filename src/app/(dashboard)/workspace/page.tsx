'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import {
  Plus, MoreVertical, Play, Check, Pencil, Trash2, Clock,
  Zap, Calendar, Flame, Repeat,
  X, ChevronLeft, ChevronRight, Eye
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import styles from './workspace.module.css';
import { useSoundEffects } from '@/hooks/useSoundEffects';

interface Task {
  id: string;
  title: string;
  descriptionHtml: string | null;
  color: string;
  status: string;
  dueDate: string | null;
  estimatedPomodoros: number;
  completedPomodoros: number;
  columnOrder: number;
  habit: { name: string; color: string; iconSvg: string; emoji: string };
  habitId: string;
}

interface Habit {
  id: string;
  name: string;
  iconSvg: string;
  emoji: string;
  color: string;
  recurrenceType: string;
  recurrenceCount: number;
  recurrenceDays: string;
  streaks: { currentCount: number; longestCount: number }[];
  _count: { tasks: number };
}

const TASK_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
];

const DAYS = [
  { key: 'dom', label: 'Dom' },
  { key: 'lun', label: 'Lun' },
  { key: 'mar', label: 'Mar' },
  { key: 'mié', label: 'Mié' },
  { key: 'jue', label: 'Jue' },
  { key: 'vie', label: 'Vie' },
  { key: 'sáb', label: 'Sáb' },
];

export default function WorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'tasks' | 'habits' | 'calendar'>(
    searchParams.get('tab') === 'habits'
      ? 'habits'
      : searchParams.get('tab') === 'calendar'
        ? 'calendar'
        : 'tasks'
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'task' | 'habit'; id: string } | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { playPop, playSuccess, playAlert } = useSoundEffects();

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskColor, setTaskColor] = useState('#6366f1');
  const [taskHabitId, setTaskHabitId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskEstPomodoros, setTaskEstPomodoros] = useState(1);

  // Habit form state
  const [habitName, setHabitName] = useState('');
  const [habitEmoji, setHabitEmoji] = useState('📚');
  const [habitColor, setHabitColor] = useState('#6366f1');
  const [habitRecurrence, setHabitRecurrence] = useState('daily');
  const [habitRecurrenceCount, setHabitRecurrenceCount] = useState(1);
  const [habitDays, setHabitDays] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarTaskAction, setCalendarTaskAction] = useState<Task | null>(null);
  const [calendarTaskPreview, setCalendarTaskPreview] = useState<Task | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: styles.editorContent },
    },
  });

  const fetchTasks = useCallback(async () => {
    const res = await fetch('/api/tasks');
    if (res.ok) setTasks(await res.json());
  }, []);

  const fetchHabits = useCallback(async () => {
    const res = await fetch('/api/habits');
    if (res.ok) setHabits(await res.json());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      const [tasksRes, habitsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/habits'),
      ]);

      if (tasksRes.ok) {
        const tasksData: Task[] = await tasksRes.json();
        if (!cancelled) {
          setTasks(tasksData);
        }
      }

      if (habitsRes.ok) {
        const habitsData: Habit[] = await habitsRes.json();
        if (!cancelled) {
          setHabits(habitsData);
        }
      }
    };

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  const openTaskModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setTaskTitle(task.title);
      setTaskColor(task.color);
      setTaskHabitId(task.habitId);
      setTaskDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setTaskEstPomodoros(task.estimatedPomodoros);
      editor?.commands.setContent(task.descriptionHtml || '');
    } else {
      setEditingTask(null);
      setTaskTitle('');
      setTaskColor('#6366f1');
      setTaskHabitId(habits[0]?.id || '');
      setTaskDueDate('');
      setTaskEstPomodoros(1);
      editor?.commands.setContent('');
    }
    playPop();
    setShowTaskModal(true);
  };

  const saveTask = async () => {
    if (!taskTitle || !taskHabitId) return;
    const body = {
      title: taskTitle,
      habitId: taskHabitId,
      color: taskColor,
      dueDate: taskDueDate || null,
      estimatedPomodoros: taskEstPomodoros,
      descriptionHtml: editor?.getHTML() || null,
    };

    if (editingTask) {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: editingTask.id, ...body }),
      });
    } else {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    playSuccess();
    setShowTaskModal(false);
    fetchTasks();
  };

  const completeTask = async (taskId: string) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status: 'done' }),
    });
    playSuccess();
    setOpenMenuId(null);
    fetchTasks();
  };

  const openHabitModal = (habit?: Habit) => {
    if (habit) {
      setEditingHabit(habit);
      setHabitName(habit.name);
      setHabitEmoji(habit.emoji || '📚');
      setHabitColor(habit.color);
      setHabitRecurrence(habit.recurrenceType);
      setHabitRecurrenceCount(habit.recurrenceCount);
      setHabitDays(habit.recurrenceDays ? habit.recurrenceDays.split(',').filter(Boolean) : []);
    } else {
      setEditingHabit(null);
      setHabitName('');
      setHabitEmoji('📚');
      setHabitColor('#6366f1');
      setHabitRecurrence('daily');
      setHabitRecurrenceCount(1);
      setHabitDays([]);
    }
    setShowEmojiPicker(false);
    playPop();
    setShowHabitModal(true);
  };

  const toggleDay = (day: string) => {
    setHabitDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const saveHabit = async () => {
    if (!habitName) return;
    const body = {
      name: habitName,
      iconSvg: 'book',
      emoji: habitEmoji,
      color: habitColor,
      recurrenceType: habitRecurrence,
      recurrenceCount: habitRecurrenceCount,
      recurrenceDays: habitDays.join(','),
    };

    if (editingHabit) {
      await fetch('/api/habits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId: editingHabit.id, ...body }),
      });
    } else {
      await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    playSuccess();
    setShowHabitModal(false);
    fetchHabits();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const endpoint = deleteConfirm.type === 'task' ? 'tasks' : 'habits';
    await fetch(`/api/${endpoint}?id=${deleteConfirm.id}`, { method: 'DELETE' });
    playAlert();
    setDeleteConfirm(null);
    if (deleteConfirm.type === 'task') fetchTasks(); else fetchHabits();
  };

  // Drag and drop handlers
  const handleDragStart = (taskId: string) => setDraggedTaskId(taskId);
  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverColumn(status);
  };
  const handleDragLeave = () => setDragOverColumn(null);
  const handleDrop = async (newStatus: string) => {
    if (!draggedTaskId) return;
    setDragOverColumn(null);
    setDraggedTaskId(null);
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: draggedTaskId, status: newStatus }),
    });
    fetchTasks();
  };

  const columns = [
    { id: 'todo', label: 'BACKLOG', dotClass: styles.columnDotTodo },
    { id: 'in_progress', label: 'IN PROGRESS', dotClass: styles.columnDotProgress },
    { id: 'done', label: 'COMPLETED', dotClass: styles.columnDotDone },
  ];

  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const startWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const dueTasksByDay = tasks.reduce<Record<string, Task[]>>((acc, task) => {
    if (!task.dueDate) return acc;
    const key = task.dueDate.slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  const calendarCells: Array<{ day: number | null; key: string; tasks: Task[] }> = [];
  for (let i = 0; i < startWeekday; i += 1) {
    calendarCells.push({ day: null, key: `empty-start-${i}`, tasks: [] });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarCells.push({ day, key, tasks: dueTasksByDay[key] || [] });
  }
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push({ day: null, key: `empty-end-${calendarCells.length}`, tasks: [] });
  }

  return (
    <div className={styles.page} onClick={() => setOpenMenuId(null)}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Workspace</h1>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'tasks' ? styles.tabActive : ''}`} onClick={() => setActiveTab('tasks')}>TASKS</button>
        <button className={`${styles.tab} ${activeTab === 'habits' ? styles.tabActive : ''}`} onClick={() => setActiveTab('habits')}>HABITS</button>
        <button className={`${styles.tab} ${activeTab === 'calendar' ? styles.tabActive : ''}`} onClick={() => setActiveTab('calendar')}>CALENDAR</button>
      </div>

      {activeTab === 'tasks' && (
        <>
          <div className={styles.kanbanHeader}>
            <h2 className={styles.kanbanTitle}>Tablero Kanban</h2>
            <button className={styles.addBtn} onClick={() => openTaskModal()}>
              <Plus size={16} /> Nueva Tarea
            </button>
          </div>

          {habits.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Crea un hábito primero antes de agregar tareas</p>
              <button className={styles.addBtn} onClick={() => { setActiveTab('habits'); openHabitModal(); }}>
                <Plus size={16} /> Crear Hábito
              </button>
            </div>
          ) : (
            <div className={styles.kanbanBoard}>
              {columns.map(col => {
                const colTasks = tasks.filter(t => t.status === col.id);
                return (
                  <div
                    key={col.id}
                    className={`${styles.kanbanColumn} ${dragOverColumn === col.id ? styles.kanbanColumnDragOver : ''}`}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(col.id)}
                  >
                    <div className={styles.columnHeader}>
                      <span className={styles.columnTitle}>
                        <span className={`${styles.columnDot} ${col.dotClass}`} />
                        {col.label}
                      </span>
                      <span className={styles.columnCount}>{colTasks.length}</span>
                    </div>
                    <div className={styles.taskList}>
                      {colTasks.map(task => (
                        <div
                          key={task.id}
                          className={`${styles.taskCard} ${draggedTaskId === task.id ? styles.taskCardDragging : ''} ${openMenuId === task.id ? styles.taskCardMenuOpen : ''}`}
                          draggable
                          onDragStart={() => handleDragStart(task.id)}
                        >
                          <div className={styles.taskCardTop}>
                            <div className={styles.taskEmojis}>
                              <span>{task.habit?.emoji || '📚'}</span>
                            </div>
                            <div className={styles.taskMenuWrap}>
                              <button
                                className={styles.taskMenuBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === task.id ? null : task.id);
                                }}
                              >
                                <MoreVertical size={16} />
                              </button>
                              {openMenuId === task.id && (
                                <div className={styles.taskMenu} onClick={(e) => e.stopPropagation()}>
                                  <button onClick={() => { setOpenMenuId(null); router.push(`/focus?taskId=${task.id}`); }}>
                                    <Play size={14} /> Comenzar
                                  </button>
                                  <button onClick={() => completeTask(task.id)}>
                                    <Check size={14} /> Completar
                                  </button>
                                  <button onClick={() => { setOpenMenuId(null); openTaskModal(task); }}>
                                    <Pencil size={14} /> Editar
                                  </button>
                                  <button className={styles.taskMenuDanger} onClick={() => { setOpenMenuId(null); setDeleteConfirm({ type: 'task', id: task.id }); }}>
                                    <Trash2 size={14} /> Eliminar
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className={styles.taskTitle}>{task.title}</div>
                          <div className={styles.taskMeta}>
                            <span className={styles.taskMetaItem}>
                              <Clock size={11} />
                              {task.completedPomodoros}/{task.estimatedPomodoros} 🍅
                            </span>
                            {task.dueDate && (
                              <span className={styles.taskMetaItem}>
                                <Calendar size={11} />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {colTasks.length === 0 && <div className={styles.emptyCol}>Arrastra tareas aquí</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'habits' && (
        <>
          <div className={styles.kanbanHeader}>
            <h2 className={styles.kanbanTitle}>Mis Hábitos</h2>
            <button className={styles.addBtn} onClick={() => openHabitModal()}>
              <Plus size={16} /> Nuevo Hábito
            </button>
          </div>
          <div className={styles.habitsContent}>
            {habits.map(habit => (
              <div key={habit.id} className={styles.habitCardLarge}>
                <div className={styles.habitCardHeader}>
                  <div className={styles.habitEmoji}>{habit.emoji || '📚'}</div>
                  <span className={styles.habitCardName}>{habit.name}</span>
                  <div className={styles.habitColorDot} style={{ background: habit.color }} />
                </div>
                <div className={styles.habitCardMeta}>
                  <span className={styles.habitCardMetaRow}>
                    <Repeat size={13} />
                    {habit.recurrenceType === 'daily' ? 'Diario' : habit.recurrenceType === 'weekly' ? `${habit.recurrenceCount}x por semana` : `${habit.recurrenceCount}x por mes`}
                  </span>
                  {habit.recurrenceDays && (
                    <span className={styles.habitCardMetaRow}>
                      <Calendar size={13} />
                      {habit.recurrenceDays.split(',').join(', ')}
                    </span>
                  )}
                  <span className={styles.habitCardMetaRow}>
                    <Flame size={13} />
                    {habit.streaks?.[0]?.currentCount || 0} días de racha
                  </span>
                  <span className={styles.habitCardMetaRow}>
                    <Zap size={13} />
                    {habit._count?.tasks || 0} tareas
                  </span>
                </div>
                <div className={styles.habitCardActions}>
                  <button className={`${styles.habitActionBtn} ${styles.habitEditBtn}`} onClick={() => openHabitModal(habit)}>
                    <Pencil size={12} /> Editar
                  </button>
                  <button className={`${styles.habitActionBtn} ${styles.habitDeleteBtn}`} onClick={() => setDeleteConfirm({ type: 'habit', id: habit.id })}>
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              </div>
            ))}
            {habits.length === 0 && (
              <div className={styles.emptyState}>
                <p>No tienes hábitos aún. ¡Crea el primero!</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'calendar' && (
        <>
          <div className={styles.kanbanHeader}>
            <h2 className={styles.kanbanTitle}>Calendario de Tareas</h2>
            <div className={styles.calendarNav}>
              <button className={styles.calendarNavBtn} onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                <ChevronLeft size={16} />
              </button>
              <span className={styles.calendarMonthLabel}>
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button className={styles.calendarNavBtn} onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className={styles.calendarViewport}>
            <div className={styles.calendarBoard}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday, index) => (
                <div
                  key={weekday}
                  className={`${styles.calendarWeekday} ${index === 0 || index === 6 ? styles.calendarWeekdayWeekend : ''}`}
                >
                  {weekday}
                </div>
              ))}

              {calendarCells.map((cell, index) => (
                <div
                  key={cell.key}
                  className={`${styles.calendarCell} ${cell.day ? '' : styles.calendarCellEmpty} ${cell.key === todayKey ? styles.calendarCellToday : ''} ${index % 7 === 0 || index % 7 === 6 ? styles.calendarCellWeekend : ''}`}
                >
                  {cell.day && (
                    <>
                      <div className={styles.calendarDayNumber}>{cell.day}</div>
                      <div className={styles.calendarTasksList}>
                        {cell.tasks.slice(0, 3).map((task) => (
                          <button
                            key={task.id}
                            className={styles.calendarTaskItem}
                            title={task.title}
                            onClick={() => {
                              setCalendarTaskAction(task);
                              playPop();
                            }}
                          >
                            <span className={styles.calendarTaskDot} style={{ background: task.color }} />
                            <span className={styles.calendarTaskTitle}>{task.title}</span>
                          </button>
                        ))}
                        {cell.tasks.length > 3 && (
                          <div className={styles.calendarMore}>+{cell.tasks.length - 3} más</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {calendarTaskAction && (
        <div className={styles.modalOverlay} onClick={() => setCalendarTaskAction(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Acciones de Tarea</span>
              <button className={styles.modalClose} onClick={() => setCalendarTaskAction(null)}><X size={18} /></button>
            </div>
            <div className={styles.calendarTaskSummary}>
              <div className={styles.taskTitle}>{calendarTaskAction.title}</div>
              <div className={styles.taskMeta}>
                <span className={styles.taskMetaItem}><Clock size={11} />{calendarTaskAction.completedPomodoros}/{calendarTaskAction.estimatedPomodoros} 🍅</span>
                {calendarTaskAction.dueDate && <span className={styles.taskMetaItem}><Calendar size={11} />{new Date(calendarTaskAction.dueDate).toLocaleDateString()}</span>}
              </div>
            </div>
            <div className={styles.calendarTaskActions}>
              <button onClick={() => { router.push(`/focus?taskId=${calendarTaskAction.id}`); setCalendarTaskAction(null); }} className={styles.calendarActionBtn}>
                <Play size={14} /> Comenzar
              </button>
              <button onClick={() => completeTask(calendarTaskAction.id)} className={styles.calendarActionBtn}>
                <Check size={14} /> Completar
              </button>
              <button onClick={() => { const selected = calendarTaskAction; setCalendarTaskAction(null); openTaskModal(selected); }} className={styles.calendarActionBtn}>
                <Pencil size={14} /> Editar
              </button>
              <button onClick={() => { setCalendarTaskPreview(calendarTaskAction); setCalendarTaskAction(null); }} className={styles.calendarActionBtn}>
                <Eye size={14} /> Visualizar
              </button>
              <button
                onClick={() => { setDeleteConfirm({ type: 'task', id: calendarTaskAction.id }); setCalendarTaskAction(null); }}
                className={`${styles.calendarActionBtn} ${styles.calendarActionDanger}`}
              >
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {calendarTaskPreview && (
        <div className={styles.modalOverlay} onClick={() => setCalendarTaskPreview(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Detalle de Tarea</span>
              <button className={styles.modalClose} onClick={() => setCalendarTaskPreview(null)}><X size={18} /></button>
            </div>
            <div className={styles.calendarTaskSummary}>
              <div className={styles.taskTitle}>{calendarTaskPreview.title}</div>
              <div className={styles.taskMeta}>
                <span className={styles.taskMetaItem}><Clock size={11} />{calendarTaskPreview.completedPomodoros}/{calendarTaskPreview.estimatedPomodoros} 🍅</span>
                {calendarTaskPreview.dueDate && <span className={styles.taskMetaItem}><Calendar size={11} />{new Date(calendarTaskPreview.dueDate).toLocaleDateString()}</span>}
              </div>
            </div>
            {calendarTaskPreview.descriptionHtml ? (
              <div className={styles.calendarTaskDescription} dangerouslySetInnerHTML={{ __html: calendarTaskPreview.descriptionHtml }} />
            ) : (
              <p className={styles.calendarNoDescription}>Sin descripción para esta tarea.</p>
            )}
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className={styles.modalOverlay} onClick={() => setShowTaskModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{editingTask ? 'Editar Tarea' : 'Nueva Tarea'}</span>
              <button className={styles.modalClose} onClick={() => setShowTaskModal(false)}><X size={18} /></button>
            </div>
            <div className={styles.modalForm}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Título *</label>
                <input className={styles.modalInput} value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Título de la tarea" />
              </div>

              <div className={styles.modalRow}>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Hábito *</label>
                  <select className={styles.modalSelect} value={taskHabitId} onChange={e => setTaskHabitId(e.target.value)}>
                    <option value="">Seleccionar hábito</option>
                    {habits.map(h => <option key={h.id} value={h.id}>{h.emoji || '📚'} {h.name}</option>)}
                  </select>
                </div>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Color del Tag</label>
                  <div className={styles.colorCircles}>
                    {TASK_COLORS.map(c => (
                      <button 
                        key={c} 
                        className={`${styles.colorCircle} ${taskColor === c ? styles.colorCircleActive : ''}`} 
                        style={{ background: c }} 
                        onClick={() => setTaskColor(c)} 
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.modalRow}>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Fecha límite</label>
                  <input className={styles.modalInput} type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} />
                </div>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Pomodoros estimados *</label>
                  <input className={styles.modalInput} type="number" min={1} value={taskEstPomodoros} onChange={e => setTaskEstPomodoros(Number(e.target.value))} />
                </div>
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Descripción</label>
                <div className={styles.editor}>
                  <div className={styles.editorToolbar}>
                    <button className={`${styles.editorToolbarBtn} ${editor?.isActive('bold') ? styles.editorToolbarBtnActive : ''}`} onClick={() => editor?.chain().focus().toggleBold().run()} title="Bold"><b>B</b></button>
                    <button className={`${styles.editorToolbarBtn} ${editor?.isActive('italic') ? styles.editorToolbarBtnActive : ''}`} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italic"><i>I</i></button>
                    <div className={styles.editorDivider} />
                    <button className={`${styles.editorToolbarBtn} ${editor?.isActive({ textAlign: 'left' }) ? styles.editorToolbarBtnActive : ''}`} onClick={() => editor?.chain().focus().setTextAlign('left').run()}>≡</button>
                    <button className={`${styles.editorToolbarBtn} ${editor?.isActive({ textAlign: 'center' }) ? styles.editorToolbarBtnActive : ''}`} onClick={() => editor?.chain().focus().setTextAlign('center').run()}>≡</button>
                    <button className={`${styles.editorToolbarBtn} ${editor?.isActive({ textAlign: 'right' }) ? styles.editorToolbarBtnActive : ''}`} onClick={() => editor?.chain().focus().setTextAlign('right').run()}>≡</button>
                    <div className={styles.editorDivider} />
                    <button className={`${styles.editorToolbarBtn} ${editor?.isActive('bulletList') ? styles.editorToolbarBtnActive : ''}`} onClick={() => editor?.chain().focus().toggleBulletList().run()}>•</button>
                    <button className={`${styles.editorToolbarBtn} ${editor?.isActive('orderedList') ? styles.editorToolbarBtnActive : ''}`} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>1.</button>
                    <div className={styles.editorDivider} />
                    <button className={`${styles.editorToolbarBtn} ${editor?.isActive('heading', { level: 1 }) ? styles.editorToolbarBtnActive : ''}`} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
                    <button className={`${styles.editorToolbarBtn} ${editor?.isActive('heading', { level: 2 }) ? styles.editorToolbarBtnActive : ''}`} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
                    <button className={`${styles.editorToolbarBtn} ${editor?.isActive('heading', { level: 3 }) ? styles.editorToolbarBtnActive : ''}`} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
                  </div>
                  <EditorContent editor={editor} />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button className={styles.modalCancelBtn} onClick={() => setShowTaskModal(false)}>Cancelar</button>
                <button className={styles.modalSubmitBtn} onClick={saveTask}>{editingTask ? 'Guardar' : 'Crear tarea'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Habit Modal */}
      {showHabitModal && (
        <div className={styles.modalOverlay} onClick={() => setShowHabitModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{editingHabit ? 'Editar Hábito' : 'Crear Nuevo Hábito'}</span>
              <button className={styles.modalClose} onClick={() => setShowHabitModal(false)}><X size={18} /></button>
            </div>
            <div className={styles.modalForm}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Emoji</label>
                <div className={styles.emojiPickerHeaderRow}>
                  <div className={styles.emojiSelected}>{habitEmoji}</div>
                  <button type="button" className={styles.emojiPickerToggle} onClick={() => setShowEmojiPicker(prev => !prev)}>
                    {showEmojiPicker ? 'Cerrar selector' : 'Elegir emoji'}
                  </button>
                </div>
                {showEmojiPicker && (
                  <div className={styles.emojiPickerWrapper}>
                    <Picker
                      data={data}
                      onEmojiSelect={(emojiData: { native?: string }) => {
                        if (emojiData.native) {
                          setHabitEmoji(emojiData.native);
                        }
                        setShowEmojiPicker(false);
                      }}
                      locale="es"
                      previewPosition="none"
                      skinTonePosition="none"
                      perLine={9}
                    />
                  </div>
                )}
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Nombre del Hábito</label>
                <input className={styles.modalInput} value={habitName} onChange={e => setHabitName(e.target.value)} placeholder="Ej: Estudiar, Ejercicio..." />
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Color del Tag</label>
                <div className={styles.colorCircles}>
                  {TASK_COLORS.map(c => (
                    <button key={c} className={`${styles.colorCircle} ${habitColor === c ? styles.colorCircleActive : ''}`} style={{ background: c }} onClick={() => setHabitColor(c)} />
                  ))}
                </div>
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Días Programados</label>
                <div className={styles.dayPicker}>
                  {DAYS.map(d => (
                    <button key={d.key} className={`${styles.dayBtn} ${habitDays.includes(d.key) ? styles.dayBtnActive : ''}`} onClick={() => toggleDay(d.key)}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button className={styles.modalCancelBtn} onClick={() => setShowHabitModal(false)}>Cancelar</button>
                <button className={styles.modalSubmitBtn} onClick={saveHabit}>{editingHabit ? 'Guardar' : 'Guardar Hábito'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className={styles.confirmOverlay} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <p>¿Estás seguro de que quieres eliminar este {deleteConfirm.type === 'task' ? 'tarea' : 'hábito'}? Esta acción no se puede deshacer.</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className={styles.confirmDelete} onClick={handleDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
