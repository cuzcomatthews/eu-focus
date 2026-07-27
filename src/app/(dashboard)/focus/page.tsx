'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Play,
  Pause,
  Check,
  Plus,
  RotateCcw,
  TreePine,
  Coffee,
  Volume2,
  Clock,
  Music2,
  Link2,
  Eye,
  EyeOff,
  ListMusic,
  PictureInPicture2,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useTimerStore } from '@/stores/timerStore';
import StreakCelebration from '@/components/StreakCelebration';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { usePiPTimer } from '@/components/PiPTimer';
import styles from './focus.module.css';

interface Task {
  id: string;
  title: string;
  status: string;
  descriptionHtml: string | null;
  estimatedPomodoros: number;
  completedPomodoros: number;
}

type AmbientSoundId = 'rain' | 'thunder' | 'fire' | 'jungle';

type AmbientSound = {
  id: AmbientSoundId;
  label: string;
  url: string;
};

type YouTubeMode = 'iframe' | 'api';

type YouTubeParsed = {
  type: 'video' | 'playlist';
  videoId?: string;
  playlistId?: string;
  startIndex?: number;
};

const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: 'rain', label: 'Rain', url: '/assets/engine/effects/rain.mp3' },
  { id: 'thunder', label: 'Thunder', url: '/assets/engine/effects/thunder.mp3' },
  { id: 'fire', label: 'Fire', url: '/assets/engine/effects/fire.mp3' },
  { id: 'jungle', label: 'Jungle', url: '/assets/engine/effects/jungle.mp3' },
];

const LOFI_SCENES = [
  'amp_prob.gif', 'attack.gif', 'bad_landing.gif', 'bicycle.gif', 'blade.gif', 'bluebalcony.gif', 'bridge.gif',
  'bridge_raining.gif', 'cacao_and_coffee_shop.gif', 'castle.gif', 'cave.gif', 'cemetry.gif', 'citymirror.gif',
  'coast.gif', 'coffeeinrain.gif', 'comition_sky_left_to_right.gif', 'controlroom.gif', 'daftpunk.gif',
  'dark_pillar.gif', 'dawn.gif', 'drift.gif', 'droidcrime.gif', 'echoesfromneals.gif', 'elderorc.gif', 'exodus.gif',
  'factory5.gif', 'falls.gif', 'familydinner.gif', 'fire.gif', 'flower_shop.gif', 'forrest.gif', 'fortress.gif',
  'future.gif', 'girlinrain.gif', 'grandcanyon.gif', 'highfloor.gif', 'highlands.gif', 'highsoceity.gif', 'horse.gif',
  'iplayoldgames.gif', 'jazznight.gif', 'lake.gif', 'last_dance.gif', 'lowlands.gif', 'lullaby.gif', 'metro_final.gif',
  'midnight_melancholy.gif', 'moon.png', 'motorcycle.gif', 'mountain.gif', 'mountain_mote.gif', 'nature.gif',
  'nero_land.gif', 'nightlytraining.gif', 'nighttrain.gif', 'northlights.gif', 'pilot.gif', 'player2.gif', 'rain.gif',
  'redbicycle.gif', 'reddriver.gif', 'ride.gif', 'robot_alley.gif', 'sandcastle.gif', 'sea.gif', 'shootingstars.gif',
  'shop.gif', 'sideshop.gif', 'skate.gif', 'snow.gif', 'spacecommander.gif', 'spaceport.gif',
  'stacking_houses_on_a_windy_day.gif', 'streets.gif', 'sushi.gif', 'swamp.gif', 'swirling.gif', 'temple.gif',
  'thieves.gif', 'tower.gif', 'town.gif', 'train.gif', 'train_city.gif', 'troll_cave.gif', 'tv.gif', 'underwater.gif',
  'virtuaverse.gif', 'wild_boy.gif', 'windyday.gif', 'youngatnight.gif', 'zombies.gif',
].map((file) => `/assets/lofi/${file}`);

const extractYouTubeEmbedUrl = (input: string): string | null => {
  const value = input.trim();
  if (!value) return null;

  const buildPlaylistUrl = (playlistId: string) => (
    `https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=1&loop=1&controls=1`
  );

  const buildVideoUrl = (videoId: string) => (
    `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=1`
  );

  if (/^[a-zA-Z0-9_-]{34}$/.test(value)) return buildPlaylistUrl(value);
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return buildVideoUrl(value);

  try {
    const parsed = new URL(value);
    const playlistId = parsed.searchParams.get('list');
    const videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();

    if (playlistId) return buildPlaylistUrl(playlistId);
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) return buildVideoUrl(videoId);
  } catch {
    return null;
  }

  return null;
};

function parseYouTubeUrl(input: string): YouTubeParsed | null {
  const value = input.trim();
  if (!value) return null;

  if (/^[a-zA-Z0-9_-]{34}$/.test(value)) {
    return { type: 'playlist', playlistId: value };
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return { type: 'video', videoId: value };
  }

  try {
    const parsed = new URL(value);
    const playlistId = parsed.searchParams.get('list');
    const videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
    const rawIndex = parseInt(parsed.searchParams.get('index') || '0', 10);
    const startIndex = Number.isFinite(rawIndex) && rawIndex > 0 ? rawIndex - 1 : undefined;

    if (playlistId && videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return { type: 'playlist', videoId, playlistId, startIndex };
    }
    if (playlistId) {
      return { type: 'playlist', playlistId, startIndex };
    }
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return { type: 'video', videoId };
    }
  } catch {
    return null;
  }

  return null;
}

export default function FocusPage() {
  const searchParams = useSearchParams();
  const preSelectedTaskId = searchParams.get('taskId');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(null);
  const prevPhaseRef = useRef<string>('idle');

  const [lofiGifIndex, setLofiGifIndex] = useState(0);
  const [isContextHidden, setIsContextHidden] = useState(false);
  const [isFullLofiMode, setIsFullLofiMode] = useState(false);

  const [lofiSourceInput, setLofiSourceInput] = useState('');
  const [lofiCustomEmbedUrl, setLofiCustomEmbedUrl] = useState<string | null>(null);
  const [lofiSourceError, setLofiSourceError] = useState<string | null>(null);
  const [youtubeMode, setYoutubeMode] = useState<YouTubeMode>('iframe');
  const [isPlaylistMode, setIsPlaylistMode] = useState(false);
  const [youtubeParsed, setYoutubeParsed] = useState<YouTubeParsed | null>(null);

  const [ambientLevels, setAmbientLevels] = useState<Record<AmbientSoundId, number>>({
    rain: 0,
    thunder: 0,
    fire: 0,
    jungle: 0,
  });
  const [ambientControlId, setAmbientControlId] = useState<AmbientSoundId | null>(null);

  const ambientAudioRefs = useRef<Record<AmbientSoundId, HTMLAudioElement>>({} as Record<AmbientSoundId, HTMLAudioElement>);
  const ambientControlHideTimerRef = useRef<number | null>(null);
  const youtubePlayerRef = useRef<unknown>(null);
  const youtubeContainerId = useRef(`yt-${Math.random().toString(36).slice(2, 10)}`);

  const {
    phase,
    timeRemaining,
    totalTime,
    isRunning,
    activeTaskId,
    startFocus,
    pause,
    resume,
    completeEarly,
    reset,
  } = useTimerStore();

  const { supported: pipSupported, isOpen: pipOpen, open: openPiP, close: closePiP } = usePiPTimer();

  const { playPop, playSuccess, playAlert } = useSoundEffects();

  const fetchTasks = useCallback(async () => {
    const res = await fetch('/api/tasks');
    if (!res.ok) return;
    const data = await res.json();
    setTasks(data.filter((t: Task) => t.status !== 'done'));
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (preSelectedTaskId && !activeTaskId) {
      setSelectedTaskId(preSelectedTaskId);
    } else if (activeTaskId) {
      setSelectedTaskId(activeTaskId);
    }
  }, [preSelectedTaskId, activeTaskId]);

  useEffect(() => {
    if (prevPhaseRef.current === 'break' && phase === 'idle') {
      playAlert();
      const currentId = activeTaskId;
      if (!currentId) {
        prevPhaseRef.current = phase;
        return;
      }
      fetch('/api/pomodoro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: currentId,
          durationMinutes: useTimerStore.getState().focusDuration,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Pomodoro API error:', err);
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (!data) return;
          if (data.streak?.increased) setCelebrationStreak(data.streak.currentCount);
          fetchTasks();
        })
        .catch((err) => {
          console.error('Failed to record pomodoro:', err);
        });
    } else if (prevPhaseRef.current === 'focus' && phase === 'break') {
      playSuccess();
    }
    prevPhaseRef.current = phase;
  }, [phase, activeTaskId, fetchTasks, playSuccess, playAlert]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  useEffect(() => {
    AMBIENT_SOUNDS.forEach((sound) => {
      let audio = ambientAudioRefs.current[sound.id];
      if (!audio) {
        audio = new Audio(sound.url);
        audio.loop = true;
        audio.preload = 'auto';
        ambientAudioRefs.current[sound.id] = audio;
      }

      const level = ambientLevels[sound.id] ?? 0;
      audio.volume = Math.max(0, Math.min(1, level / 100));

      if (activeSound === 'lofi' && level > 0) {
        audio.play().catch(() => {
          // browser autoplay restrictions can block this until user interacts
        });
      } else {
        audio.pause();
      }
    });
  }, [ambientLevels, activeSound]);

  useEffect(() => {
    if (activeSound !== 'lofi') {
      setIsFullLofiMode(false);
      Object.values(ambientAudioRefs.current).forEach((audio) => audio.pause());
    }
  }, [activeSound]);

  useEffect(() => {
    if (youtubeMode !== 'api' || !youtubeParsed?.playlistId) return;

    const parsed = youtubeParsed;

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.getElementsByTagName('script')[0]?.parentNode?.insertBefore(tag, document.getElementsByTagName('script')[0]);
    }

    let cancelled = false;

    function initPlayer() {
      if (cancelled) return;
      const containerId = youtubeContainerId.current;
      const el = document.getElementById(containerId);
      if (!el) return;

      if (youtubePlayerRef.current) {
        try { (youtubePlayerRef.current as { destroy?: () => void })?.destroy?.(); } catch { /* ignore */ }
      }

      const win = window as unknown as Record<string, unknown>;
      if (!win.YT || !(win.YT as Record<string, unknown>)?.Player) return;

      const YTP = (win.YT as Record<string, unknown>).Player as new (
        el: string | HTMLElement,
        cfg: Record<string, unknown>
      ) => Record<string, unknown>;

      youtubePlayerRef.current = new YTP(el, {
        height: '100%',
        width: '100%',
        playerVars: { autoplay: 1, controls: 1 },
        events: {
          onReady: () => {
            if (cancelled) return;
            const p = youtubePlayerRef.current as Record<string, unknown> | null;
            if (!p) return;
            const loadPlaylist = p.loadPlaylist as ((opts: { list: string; listType: string; index?: number }) => void) | undefined;
            if (!loadPlaylist) return;
            loadPlaylist({
              list: parsed.playlistId!,
              listType: 'playlist',
              index: parsed.startIndex ?? 0,
            });
          },
        },
      });
    }

    if ((window as unknown as Record<string, unknown>).YT) {
      initPlayer();
    } else {
      (window as unknown as Record<string, unknown>).onYouTubeIframeAPIReady = () => {
        if (!cancelled) initPlayer();
      };
    }

    return () => {
      cancelled = true;
      try { (youtubePlayerRef.current as { destroy?: () => void })?.destroy?.(); } catch { /* ignore */ }
      youtubePlayerRef.current = null;
    };
  }, [youtubeMode, youtubeParsed?.playlistId, youtubeParsed?.startIndex]);

  useEffect(() => {
    const ambientMap = ambientAudioRefs.current;
    return () => {
      Object.values(ambientMap).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });

      if (ambientControlHideTimerRef.current) {
        window.clearTimeout(ambientControlHideTimerRef.current);
      }

      try { (youtubePlayerRef.current as { destroy?: () => void })?.destroy?.(); } catch { /* ignore */ }
    };
  }, []);

  const handleStart = () => {
    if (!selectedTask) return;
    playPop();
    startFocus(selectedTask.id, selectedTask.title);
  };

  const handleAddPomodoro = async () => {
    if (!selectedTask) return;

    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: selectedTask.id,
        estimatedPomodoros: selectedTask.estimatedPomodoros + 1,
      }),
    });
    fetchTasks();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progress = totalTime > 0 ? 1 - timeRemaining / totalTime : 0;
  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference * (1 - progress);

  const goToPrevLofiScene = () => {
    setLofiGifIndex((prev) => (prev - 1 + LOFI_SCENES.length) % LOFI_SCENES.length);
  };

  const goToNextLofiScene = () => {
    setLofiGifIndex((prev) => (prev + 1) % LOFI_SCENES.length);
  };

  const applyCustomLofiSource = () => {
    const parsed = parseYouTubeUrl(lofiSourceInput);
    if (!parsed) {
      setLofiSourceError('Use a valid YouTube video or playlist URL.');
      return;
    }

    setActiveSound('lofi');
    setLofiSourceError(null);
    setYoutubeParsed(parsed);

    if (parsed.type === 'playlist') {
      setYoutubeMode('api');
      setIsPlaylistMode(true);
      setLofiCustomEmbedUrl(null);
    } else {
      const embed = extractYouTubeEmbedUrl(lofiSourceInput);
      setYoutubeMode('iframe');
      setIsPlaylistMode(false);
      setLofiCustomEmbedUrl(embed);
    }
  };

  const toggleLofi = () => {
    if (activeSound === 'lofi') {
      setActiveSound(null);
      return;
    }
    setActiveSound('lofi');
  };

  const revealAmbientControl = (soundId: AmbientSoundId) => {
    setAmbientControlId(soundId);
    if (ambientControlHideTimerRef.current) {
      window.clearTimeout(ambientControlHideTimerRef.current);
    }
    ambientControlHideTimerRef.current = window.setTimeout(() => {
      setAmbientControlId(null);
    }, 1300);
  };

  const toggleAmbientSound = (soundId: AmbientSoundId) => {
    setActiveSound('lofi');
    setAmbientLevels((prev) => {
      const current = prev[soundId] ?? 0;
      return { ...prev, [soundId]: current > 0 ? 0 : 52 };
    });
    revealAmbientControl(soundId);
  };

  const handleAmbientLevelChange = (soundId: AmbientSoundId, level: number) => {
    setActiveSound('lofi');
    setAmbientLevels((prev) => ({ ...prev, [soundId]: level }));
    revealAmbientControl(soundId);
  };

  const handleTimerPanelClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (activeSound !== 'lofi') return;
    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, label, [role="button"]')) return;
    goToNextLofiScene();
  };

  return (
    <div className={`${styles.page} ${activeSound === 'lofi' ? styles.pageLofi : ''}`}>
      {activeSound === 'lofi' && (
        <div className={styles.lofiScreenBackdrop}>
          <Image
            src={LOFI_SCENES[lofiGifIndex]}
            alt="LoFi full screen background"
            className={styles.lofiScreenBackdropImage}
            fill
            unoptimized
          />
        </div>
      )}

      {celebrationStreak !== null && (
        <StreakCelebration streak={celebrationStreak} onComplete={() => setCelebrationStreak(null)} />
      )}

      <div
        className={`${styles.timerPanel} ${activeSound === 'lofi' && isFullLofiMode ? styles.timerPanelFocusOnly : ''}`}
        onClick={handleTimerPanelClick}
      >
        {!isFullLofiMode && (
          <div
            className={`${styles.phaseTag} ${
              phase === 'focus' ? styles.phaseTagFocus : phase === 'break' ? styles.phaseTagBreak : styles.phaseTagIdle
            }`}
          >
            {phase === 'focus' ? 'Focus Mode' : phase === 'break' ? 'Break Time' : 'Ready'}
          </div>
        )}

        <div className={styles.timerCircle}>
          <svg className={styles.timerSvg} viewBox="0 0 260 260">
            <circle className={styles.timerBgCircle} cx="130" cy="130" r="120" />
            {phase !== 'idle' && (
              <circle
                className={`${styles.timerProgressCircle} ${
                  phase === 'focus' ? styles.timerProgressFocus : styles.timerProgressBreak
                }`}
                cx="130"
                cy="130"
                r="120"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            )}
          </svg>

          <div className={styles.timerCenter}>
            {phase === 'break' ? <Coffee className={styles.timerIcon} size={48} /> : <TreePine className={styles.timerIcon} size={48} />}
            <div
              className={`${styles.timerTime} ${
                phase === 'focus' ? styles.timerTimeFocus : phase === 'break' ? styles.timerTimeBreak : styles.timerTimeIdle
              }`}
            >
              {phase === 'idle' ? formatTime(useTimerStore.getState().focusDuration * 60) : formatTime(timeRemaining)}
            </div>
          </div>
        </div>

        <div className={styles.controls}>
          {phase === 'idle' ? (
            <button className={`${styles.controlBtn} ${styles.controlBtnPrimary}`} onClick={handleStart} disabled={!selectedTask} title="Start focus">
              <Play size={22} />
            </button>
          ) : (
            <>
              <button className={`${styles.controlBtn} ${styles.controlBtnSecondary}`} onClick={isRunning ? pause : resume} title={isRunning ? 'Pause' : 'Resume'}>
                {isRunning ? <Pause size={20} /> : <Play size={20} />}
              </button>

              {phase === 'focus' && (
                <button
                  className={`${styles.controlBtn} ${styles.controlBtnSuccess}`}
                  onClick={() => {
                    playSuccess();
                    completeEarly();
                  }}
                  title="Complete early"
                >
                  <Check size={20} />
                </button>
              )}

              <button className={`${styles.controlBtn} ${styles.controlBtnSecondary}`} onClick={handleAddPomodoro} title="Add +1 pomodoro">
                <Plus size={20} />
              </button>

              <button className={`${styles.controlBtn} ${styles.controlBtnDanger}`} onClick={reset} title="Reset timer">
                <RotateCcw size={18} />
              </button>
            </>
          )}
        </div>

        {!isFullLofiMode && (
          <div className={styles.audioSection}>
            <div className={styles.audioTitle}>
              <Volume2 size={14} />
              Tools
            </div>
            <div className={styles.audioGrid}>
              <button className={`${styles.audioBtn} ${activeSound === 'lofi' ? styles.audioBtnActive : ''}`} onClick={toggleLofi}>
                <Music2 size={13} />
                LoFi Radio
              </button>

              {activeSound === 'lofi' && (
                <button className={`${styles.audioBtn} ${isFullLofiMode ? styles.audioBtnActive : ''}`} onClick={() => setIsFullLofiMode((prev) => !prev)}>
                  {isFullLofiMode ? <Eye size={13} /> : <EyeOff size={13} />}
                  Full LoFi
                </button>
              )}

              {pipSupported && (
                <button className={`${styles.audioBtn} ${pipOpen ? styles.audioBtnActive : ''}`} onClick={pipOpen ? closePiP : openPiP}>
                  <PictureInPicture2 size={13} />
                  {pipOpen ? 'Close PiP' : 'Floating Timer'}
                </button>
              )}
            </div>

            <div className={styles.ambientSection}>
              <div className={styles.ambientHeader}>Ambient Sounds</div>
              <div className={styles.ambientPills}>
                {AMBIENT_SOUNDS.map((sound) => {
                  const level = ambientLevels[sound.id] ?? 0;
                  return (
                    <button
                      key={sound.id}
                      className={`${styles.ambientPill} ${level > 0 ? styles.ambientPillActive : ''}`}
                      onClick={() => toggleAmbientSound(sound.id)}
                    >
                      {sound.label}
                    </button>
                  );
                })}
              </div>

              {ambientControlId && (
                <div className={styles.ambientControlDock}>
                  <span className={styles.ambientControlLabel}>{AMBIENT_SOUNDS.find((sound) => sound.id === ambientControlId)?.label}</span>
                  <input
                    className={styles.ambientControlSlider}
                    type="range"
                    min={0}
                    max={100}
                    value={ambientLevels[ambientControlId]}
                    onChange={(e) => handleAmbientLevelChange(ambientControlId, Number(e.target.value))}
                  />
                  <span className={styles.ambientControlValue}>{ambientLevels[ambientControlId]}%</span>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {activeSound === 'lofi' && (
        <div className={styles.lofiSceneOverlay}>
          <button className={styles.lofiSceneBtn} onClick={goToPrevLofiScene} title="Previous scene">
            <SkipBack size={15} />
          </button>
          <span className={styles.lofiSceneCount}>Scene {lofiGifIndex + 1} / {LOFI_SCENES.length}</span>
          <button className={styles.lofiSceneBtn} onClick={goToNextLofiScene} title="Next scene">
            <SkipForward size={15} />
          </button>
        </div>
      )}

      {!isContextHidden && (
        <div className={`${styles.contextPanel} ${activeSound === 'lofi' ? styles.contextPanelLofi : ''}`}>
          <div className={styles.contextHeaderRow}>
            <div className={styles.contextTitle}>Active Task</div>
            <button className={styles.contextHideBtn} onClick={() => setIsContextHidden(true)}>
              <EyeOff size={14} /> Hide
            </button>
          </div>

          {phase === 'idle' && (
            <div className={styles.taskSelectorCard}>
              <div className={styles.taskSelectorLabel}>Select Task</div>
              <select className={styles.taskSelectorDropdown} value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}>
                <option value="">Choose task...</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedTask ? (
            <div className={styles.taskDetailCard}>
              <div className={styles.contextTaskTitle}>{selectedTask.title}</div>
              {selectedTask.descriptionHtml && (
                <div className={styles.contextDescription} dangerouslySetInnerHTML={{ __html: selectedTask.descriptionHtml }} />
              )}
              <div className={styles.contextPomodoros}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={14} />
                  <span className={styles.contextPomodoroCount}>{selectedTask.completedPomodoros}</span>
                  / {selectedTask.estimatedPomodoros} pomodoros
                </div>
                <div className={styles.pomodoroDots}>
                  {Array.from({ length: selectedTask.estimatedPomodoros || 1 }).map((_, i) => (
                    <div key={i} className={`${styles.pomodoroDot} ${i < selectedTask.completedPomodoros ? styles.pomodoroDotFilled : ''}`} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.contextEmpty}>
              <TreePine size={40} className={styles.contextEmptyIcon} />
              <p>Select a task to see its details here</p>
              <p style={{ fontSize: '12px' }}>Your Focus Garden grows with every completed pomodoro</p>
            </div>
          )}

          <div className={styles.youtubePlayerPanel}>
            <div className={styles.youtubePanelHeader}>
              <Link2 size={15} />
              <span>Radio AI (YouTube)</span>
            </div>

            <div className={styles.youtubeInputRow}>
              <input
                className={styles.youtubeUrlInput}
                placeholder="Paste a YouTube video or playlist URL"
                value={lofiSourceInput}
                onChange={(e) => setLofiSourceInput(e.target.value)}
              />
              <button className={styles.youtubeApplyBtn} onClick={applyCustomLofiSource}>
                <Link2 size={13} />
                Apply
              </button>
            </div>

            {lofiSourceError && <p className={styles.lofiErrorText}>{lofiSourceError}</p>}

            {youtubeMode === 'api' && youtubeParsed?.playlistId ? (
              <div className={styles.youtubeFrameShell} key={`api-${youtubeParsed.playlistId}`}>
                <div id={youtubeContainerId.current} className={styles.youtubeFrame} />
                {isPlaylistMode && (
                  <div className={styles.playlistIndicator}>
                    <ListMusic size={12} />
                    Reproduciendo playlist
                  </div>
                )}
              </div>
            ) : lofiCustomEmbedUrl ? (
              <div className={styles.youtubeFrameShell}>
                <iframe
                  key={lofiCustomEmbedUrl}
                  className={styles.youtubeFrame}
                  src={lofiCustomEmbedUrl}
                  title="YouTube player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            ) : (
              <p className={styles.libraryEmpty}>No URL loaded. Paste one to start YouTube playback.</p>
            )}
          </div>
        </div>
      )}

      {isContextHidden && (
        <button className={styles.contextRevealBtn} onClick={() => setIsContextHidden(false)} title="Show Active Task panel">
          <Eye size={16} />
        </button>
      )}

      {activeSound === 'lofi' && isFullLofiMode && (
        <button className={styles.fullLofiRevealBtn} onClick={() => setIsFullLofiMode(false)} title="Show control panel">
          <Eye size={16} />
        </button>
      )}
    </div>
  );
}
