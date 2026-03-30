import { create } from 'zustand';

export type TimerPhase = 'idle' | 'focus' | 'break';

interface TimerState {
  phase: TimerPhase;
  timeRemaining: number; // seconds
  totalTime: number; // seconds
  isRunning: boolean;
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  activeHabitName: string | null;
  focusDuration: number; // minutes
  breakDuration: number; // minutes
  startTimestamp: number | null; // epoch ms for persistence

  // Actions
  startFocus: (taskId: string, taskTitle: string, habitName: string) => void;
  startBreak: () => void;
  pause: () => void;
  resume: () => void;
  tick: () => void;
  completeEarly: () => void;
  reset: () => void;
  setDurations: (focus: number, breakMin: number) => void;
  restoreFromStorage: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  phase: 'idle',
  timeRemaining: 0,
  totalTime: 0,
  isRunning: false,
  activeTaskId: null,
  activeTaskTitle: null,
  activeHabitName: null,
  focusDuration: 25,
  breakDuration: 5,
  startTimestamp: null,

  startFocus: (taskId, taskTitle, habitName) => {
    const duration = get().focusDuration * 60;
    const now = Date.now();
    set({
      phase: 'focus',
      timeRemaining: duration,
      totalTime: duration,
      isRunning: true,
      activeTaskId: taskId,
      activeTaskTitle: taskTitle,
      activeHabitName: habitName,
      startTimestamp: now,
    });
    persistTimer({
      phase: 'focus',
      startTimestamp: now,
      totalTime: duration,
      taskId,
      taskTitle,
      habitName,
      isPaused: false,
      pausedRemaining: 0,
    });
  },

  startBreak: () => {
    const duration = get().breakDuration * 60;
    const now = Date.now();
    set({
      phase: 'break',
      timeRemaining: duration,
      totalTime: duration,
      isRunning: true,
      startTimestamp: now,
    });
    persistTimer({
      phase: 'break',
      startTimestamp: now,
      totalTime: duration,
      taskId: get().activeTaskId,
      taskTitle: get().activeTaskTitle,
      habitName: get().activeHabitName,
      isPaused: false,
      pausedRemaining: 0,
    });
  },

  pause: () => {
    set({ isRunning: false });
    const state = get();
    persistTimer({
      phase: state.phase,
      startTimestamp: state.startTimestamp,
      totalTime: state.totalTime,
      taskId: state.activeTaskId,
      taskTitle: state.activeTaskTitle,
      habitName: state.activeHabitName,
      isPaused: true,
      pausedRemaining: state.timeRemaining,
    });
  },

  resume: () => {
    const remaining = get().timeRemaining;
    const now = Date.now();
    set({
      isRunning: true,
      startTimestamp: now - ((get().totalTime - remaining) * 1000),
    });
    const state = get();
    persistTimer({
      phase: state.phase,
      startTimestamp: now - ((state.totalTime - remaining) * 1000),
      totalTime: state.totalTime,
      taskId: state.activeTaskId,
      taskTitle: state.activeTaskTitle,
      habitName: state.activeHabitName,
      isPaused: false,
      pausedRemaining: 0,
    });
  },

  tick: () => {
    const state = get();
    if (!state.isRunning || state.phase === 'idle') return;

    const newTime = state.timeRemaining - 1;
    if (newTime <= 0) {
      if (state.phase === 'focus') {
        // Auto transition to break
        get().startBreak();
      } else {
        // Break complete - pomodoro done!
        set({
          phase: 'idle',
          timeRemaining: 0,
          totalTime: 0,
          isRunning: false,
          startTimestamp: null,
        });
        clearPersistedTimer();
        // Signal completion (handled by component)
      }
    } else {
      set({ timeRemaining: newTime });
    }
  },

  completeEarly: () => {
    // Skip remaining focus time, go to break
    get().startBreak();
  },

  reset: () => {
    set({
      phase: 'idle',
      timeRemaining: 0,
      totalTime: 0,
      isRunning: false,
      activeTaskId: null,
      activeTaskTitle: null,
      activeHabitName: null,
      startTimestamp: null,
    });
    clearPersistedTimer();
  },

  setDurations: (focus, breakMin) => {
    set({ focusDuration: focus, breakDuration: breakMin });
  },

  restoreFromStorage: () => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('eu-focus-timer');
    if (!stored) return;

    try {
      const data = JSON.parse(stored);
      const now = Date.now();
      const elapsed = Math.floor((now - data.startTimestamp) / 1000);

      if (data.isPaused) {
        set({
          phase: data.phase,
          timeRemaining: data.pausedRemaining,
          totalTime: data.totalTime,
          isRunning: false,
          activeTaskId: data.taskId,
          activeTaskTitle: data.taskTitle,
          activeHabitName: data.habitName,
          startTimestamp: data.startTimestamp,
        });
      } else {
        const remaining = data.totalTime - elapsed;
        if (remaining > 0) {
          set({
            phase: data.phase,
            timeRemaining: remaining,
            totalTime: data.totalTime,
            isRunning: true,
            activeTaskId: data.taskId,
            activeTaskTitle: data.taskTitle,
            activeHabitName: data.habitName,
            startTimestamp: data.startTimestamp,
          });
        } else {
          clearPersistedTimer();
        }
      }
    } catch {
      clearPersistedTimer();
    }
  },
}));

interface PersistedTimer {
  phase: string;
  startTimestamp: number | null;
  totalTime: number;
  taskId: string | null;
  taskTitle: string | null;
  habitName: string | null;
  isPaused: boolean;
  pausedRemaining: number;
}

function persistTimer(data: PersistedTimer) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('eu-focus-timer', JSON.stringify(data));
  }
}

function clearPersistedTimer() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('eu-focus-timer');
  }
}
