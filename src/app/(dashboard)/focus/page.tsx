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
  Upload,
  Music2,
  SkipBack,
  SkipForward,
  Link2,
  Search,
  Eye,
  EyeOff,
  PlusCircle,
  X,
} from 'lucide-react';
import { useTimerStore } from '@/stores/timerStore';
import StreakCelebration from '@/components/StreakCelebration';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import styles from './focus.module.css';

interface Task {
  id: string;
  title: string;
  status: string;
  descriptionHtml: string | null;
  habitId: string;
  estimatedPomodoros: number;
  completedPomodoros: number;
  habit: { name: string; color: string; iconSvg: string };
}

type FocusTool = 'radioAI' | 'tracklist';

type CustomSound = {
  id: string;
  name: string;
  url: string;
};

type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
};

type AmbientSoundId = 'rain' | 'thunder' | 'fire' | 'jungle';

type AmbientSound = {
  id: AmbientSoundId;
  label: string;
  url: string;
};

const STORAGE_KEY_PLAYLISTS = 'euFocusTrackPlaylistsV1';

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

const formatDuration = (seconds: number | undefined) => {
  if (!seconds || Number.isNaN(seconds)) return '--:--';
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function FocusPage() {
  const searchParams = useSearchParams();
  const preSelectedTaskId = searchParams.get('taskId');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(null);
  const prevPhaseRef = useRef<string>('idle');

  const [customSounds, setCustomSounds] = useState<CustomSound[]>([]);
  const [lofiGifIndex, setLofiGifIndex] = useState(0);
  const [isContextHidden, setIsContextHidden] = useState(false);
  const [isFullLofiMode, setIsFullLofiMode] = useState(false);
  const [activeTool, setActiveTool] = useState<FocusTool>('tracklist');

  const [lofiSourceInput, setLofiSourceInput] = useState('');
  const [lofiCustomEmbedUrl, setLofiCustomEmbedUrl] = useState<string | null>(null);
  const [lofiSourceError, setLofiSourceError] = useState<string | null>(null);

  const [trackIndex, setTrackIndex] = useState(0);
  const [isTrackPlaying, setIsTrackPlaying] = useState(false);
  const [trackVolume, setTrackVolume] = useState(70);
  const [isTrackVolumeVisible, setIsTrackVolumeVisible] = useState(false);
  const [trackDurations, setTrackDurations] = useState<Record<string, number>>({});

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string>('all');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [trackSearch, setTrackSearch] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [playlistTargetId, setPlaylistTargetId] = useState<string>('');

  const [ambientLevels, setAmbientLevels] = useState<Record<AmbientSoundId, number>>({
    rain: 0,
    thunder: 0,
    fire: 0,
    jungle: 0,
  });
  const [ambientControlId, setAmbientControlId] = useState<AmbientSoundId | null>(null);

  const customAudioInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const trackAudioRef = useRef<HTMLAudioElement | null>(null);
  const ambientAudioRefs = useRef<Record<AmbientSoundId, HTMLAudioElement>>({} as Record<AmbientSoundId, HTMLAudioElement>);
  const ambientControlHideTimerRef = useRef<number | null>(null);
  const trackVolumeHideTimerRef = useRef<number | null>(null);

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

  const { playPop, playSuccess, playAlert } = useSoundEffects();

  const fetchTasks = useCallback(async () => {
    const res = await fetch('/api/tasks');
    if (!res.ok) return;
    const data = await res.json();
    setTasks(data.filter((t: Task) => t.status !== 'done'));
  }, []);

  const fetchCustomSounds = useCallback(async () => {
    const res = await fetch('/api/audio-files');
    if (!res.ok) return;
    const data: CustomSound[] = await res.json();
    setCustomSounds(data);
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchCustomSounds();
  }, [fetchTasks, fetchCustomSounds]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PLAYLISTS);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Playlist[];
      if (!Array.isArray(parsed)) return;
      setPlaylists(parsed.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.trackIds)));
    } catch {
      // ignore corrupted local storage and keep empty playlists
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    if (!playlistTargetId && playlists.length > 0) {
      setPlaylistTargetId(playlists[0].id);
    }
    if (playlists.length === 0) {
      setPlaylistTargetId('');
      if (activePlaylistId !== 'all') {
        setActivePlaylistId('all');
      }
    }
  }, [playlists, playlistTargetId, activePlaylistId]);

  useEffect(() => {
    if (preSelectedTaskId && !activeTaskId) {
      setSelectedTaskId(preSelectedTaskId);
    } else if (activeTaskId) {
      setSelectedTaskId(activeTaskId);
    }
  }, [preSelectedTaskId, activeTaskId]);

  useEffect(() => {
    if (isSearchExpanded) {
      searchInputRef.current?.focus();
    }
  }, [isSearchExpanded]);

  useEffect(() => {
    if (prevPhaseRef.current === 'break' && phase === 'idle') {
      playAlert();
      const task = tasks.find((t) => t.id === activeTaskId);
      if (task) {
        fetch('/api/pomodoro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: task.id,
            habitId: task.habitId,
            durationMinutes: useTimerStore.getState().focusDuration,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.streak?.increased) setCelebrationStreak(data.streak.currentCount);
            fetchTasks();
          });
      }
    } else if (prevPhaseRef.current === 'focus' && phase === 'break') {
      playSuccess();
    }
    prevPhaseRef.current = phase;
  }, [phase, activeTaskId, tasks, fetchTasks, playSuccess, playAlert]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);
  const selectedPlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) || null;
  const scopedTracks = activePlaylistId === 'all'
    ? customSounds
    : customSounds.filter((track) => selectedPlaylist?.trackIds.includes(track.id));
  const visibleTracks = scopedTracks.filter((track) => {
    if (!trackSearch.trim()) return true;
    return track.name.toLowerCase().includes(trackSearch.trim().toLowerCase());
  });
  const currentTrack = visibleTracks[trackIndex] ?? null;

  useEffect(() => {
    if (visibleTracks.length === 0) {
      setTrackIndex(0);
      setIsTrackPlaying(false);
      return;
    }

    if (trackIndex > visibleTracks.length - 1) {
      setTrackIndex(0);
    }
  }, [visibleTracks, trackIndex]);

  useEffect(() => {
    customSounds.forEach((sound) => {
      if (trackDurations[sound.id] !== undefined) return;
      const probe = new Audio(sound.url);
      probe.preload = 'metadata';
      probe.addEventListener('loadedmetadata', () => {
        setTrackDurations((prev) => {
          if (prev[sound.id] !== undefined) return prev;
          return { ...prev, [sound.id]: probe.duration };
        });
      });
    });
  }, [customSounds, trackDurations]);

  useEffect(() => {
    if (!currentTrack) {
      if (trackAudioRef.current) {
        trackAudioRef.current.pause();
        trackAudioRef.current.currentTime = 0;
      }
      return;
    }

    if (!trackAudioRef.current) {
      trackAudioRef.current = new Audio();
      trackAudioRef.current.preload = 'auto';
    }

    const audio = trackAudioRef.current;
    if (audio.src !== currentTrack.url) audio.src = currentTrack.url;

    audio.volume = Math.max(0, Math.min(1, trackVolume / 100));

    if (activeSound === 'lofi' && isTrackPlaying) {
      audio.play().catch(() => {
        // browser autoplay restrictions can block this until user interacts
      });
    } else {
      audio.pause();
    }
  }, [currentTrack, isTrackPlaying, trackVolume, activeSound]);

  useEffect(() => {
    const audio = trackAudioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      const hasNext = trackIndex < visibleTracks.length - 1;
      if (hasNext) {
        setTrackIndex((prev) => prev + 1);
        setIsTrackPlaying(true);
        return;
      }

      if (visibleTracks.length > 0) {
        setTrackIndex(0);
        setIsTrackPlaying(true);
        return;
      }

      setIsTrackPlaying(false);
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [trackIndex, visibleTracks.length]);

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
      setIsTrackPlaying(false);
      Object.values(ambientAudioRefs.current).forEach((audio) => audio.pause());
    }
  }, [activeSound]);

  useEffect(() => {
    const ambientMap = ambientAudioRefs.current;
    return () => {
      if (trackAudioRef.current) {
        trackAudioRef.current.pause();
        trackAudioRef.current.currentTime = 0;
      }

      Object.values(ambientMap).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });

      if (ambientControlHideTimerRef.current) {
        window.clearTimeout(ambientControlHideTimerRef.current);
      }

      if (trackVolumeHideTimerRef.current) {
        window.clearTimeout(trackVolumeHideTimerRef.current);
      }
    };
  }, []);

  const handleCustomSoundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Please upload an audio file.');
      return;
    }

    try {
      const res = await fetch(`/api/audio-files?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
      });

      if (!res.ok) {
        alert('Audio upload failed.');
        return;
      }

      const created: CustomSound = await res.json();
      setCustomSounds((prev) => [created, ...prev]);
      setTrackIndex(0);
      setActiveSound('lofi');
      setActiveTool('tracklist');
      setIsTrackPlaying(true);
    } catch (err) {
      console.error(err);
      alert('An error occurred while uploading audio.');
    } finally {
      event.target.value = '';
    }
  };

  const handleStart = () => {
    if (!selectedTask) return;
    playPop();
    startFocus(selectedTask.id, selectedTask.title, selectedTask.habit.name);
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
    const embed = extractYouTubeEmbedUrl(lofiSourceInput);
    if (!embed) {
      setLofiSourceError('Use a valid YouTube video or playlist URL.');
      return;
    }

    setActiveSound('lofi');
    setIsTrackPlaying(false);
    setLofiCustomEmbedUrl(embed);
    setLofiSourceError(null);
  };

  const toggleLofi = () => {
    if (activeSound === 'lofi') {
      setActiveSound(null);
      return;
    }
    setActiveSound('lofi');
  };

  const selectTool = (tool: FocusTool) => {
    setActiveTool(tool);
    setActiveSound('lofi');
    if (tool === 'radioAI') setIsTrackPlaying(false);
  };

  const goToPreviousTrack = () => {
    if (!visibleTracks.length) return;
    setTrackIndex((prev) => (prev - 1 + visibleTracks.length) % visibleTracks.length);
    setIsTrackPlaying(true);
  };

  const goToNextTrack = () => {
    if (!visibleTracks.length) return;
    setTrackIndex((prev) => (prev + 1) % visibleTracks.length);
    setIsTrackPlaying(true);
  };

  const createPlaylist = () => {
    const cleaned = newPlaylistName.trim();
    if (!cleaned) return;

    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}`,
      name: cleaned,
      trackIds: [],
    };

    setPlaylists((prev) => [...prev, newPlaylist]);
    setNewPlaylistName('');
    setIsPlaylistModalOpen(false);
    setActivePlaylistId(newPlaylist.id);
    setPlaylistTargetId(newPlaylist.id);
  };

  const addTrackToPlaylist = (trackId: string) => {
    if (!playlistTargetId) return;
    setPlaylists((prev) => prev.map((playlist) => {
      if (playlist.id !== playlistTargetId) return playlist;
      if (playlist.trackIds.includes(trackId)) return playlist;
      return { ...playlist, trackIds: [...playlist.trackIds, trackId] };
    }));
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

  const toggleTrackVolumePanel = () => {
    setIsTrackVolumeVisible((prev) => !prev);
  };

  const handleTrackVolumeChange = (value: number) => {
    setTrackVolume(value);
    setIsTrackVolumeVisible(true);
    if (trackVolumeHideTimerRef.current) {
      window.clearTimeout(trackVolumeHideTimerRef.current);
    }
    trackVolumeHideTimerRef.current = window.setTimeout(() => {
      setIsTrackVolumeVisible(false);
    }, 1400);
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

              <button className={`${styles.audioBtn} ${activeTool === 'radioAI' ? styles.audioBtnActive : ''}`} onClick={() => selectTool('radioAI')}>
                <Link2 size={13} />
                Radio AI
              </button>

              <button className={`${styles.audioBtn} ${activeTool === 'tracklist' ? styles.audioBtnActive : ''}`} onClick={() => selectTool('tracklist')}>
                <Music2 size={13} />
                Tracklist
              </button>

              {activeSound === 'lofi' && (
                <button className={`${styles.audioBtn} ${isFullLofiMode ? styles.audioBtnActive : ''}`} onClick={() => setIsFullLofiMode((prev) => !prev)}>
                  {isFullLofiMode ? <Eye size={13} /> : <EyeOff size={13} />}
                  Full LoFi
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
                    {t.title} ({t.habit.name})
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

          {activeTool === 'radioAI' && (
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

              {lofiCustomEmbedUrl ? (
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
          )}

          {activeTool === 'tracklist' && (
            <div className={styles.tracklistShell}>
              <div className={styles.tracklistNowPlaying}>
                <div className={styles.trackArtworkWrap}>
                  <Image
                    src={LOFI_SCENES[lofiGifIndex]}
                    alt="Current scene cover"
                    className={styles.trackArtwork}
                    fill
                    unoptimized
                  />
                </div>
                <div className={styles.trackNowMeta}>
                  <p className={styles.trackNowLabel}>Now Playing</p>
                  <h3 className={styles.trackNowTitle}>{currentTrack?.name ?? 'No track selected'}</h3>
                  <p className={styles.trackNowSub}>{activePlaylistId === 'all' ? 'Library' : selectedPlaylist?.name}</p>
                </div>
              </div>

              <input
                ref={customAudioInputRef}
                type="file"
                accept="audio/*"
                className={styles.hiddenFileInput}
                onChange={handleCustomSoundUpload}
              />

              <div className={styles.trackControlsCenter}>
                <button className={styles.trackControlIconBtn} onClick={goToPreviousTrack} title="Previous track">
                  <SkipBack size={18} />
                </button>
                <button
                  className={styles.trackPlayMainBtnCenter}
                  onClick={() => setIsTrackPlaying((prev) => !prev)}
                  disabled={!currentTrack || activeSound !== 'lofi'}
                  title={isTrackPlaying ? 'Pause' : 'Play'}
                >
                  {isTrackPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button className={styles.trackControlIconBtn} onClick={goToNextTrack} title="Next track">
                  <SkipForward size={18} />
                </button>

                <div className={styles.trackVolumeWrapCenter}>
                  <button className={styles.trackControlIconBtn} onClick={toggleTrackVolumePanel} title="Track volume">
                    <Volume2 size={16} />
                  </button>
                  {isTrackVolumeVisible && (
                    <div className={styles.trackVolumePanel}>
                      <input
                        className={styles.trackVolumeSlider}
                        type="range"
                        min={0}
                        max={100}
                        value={trackVolume}
                        onChange={(e) => handleTrackVolumeChange(Number(e.target.value))}
                      />
                      <span>{trackVolume}%</span>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.trackFuncRow}>
                <button className={styles.trackFuncBtn} onClick={() => customAudioInputRef.current?.click()}>
                  <Upload size={14} />
                  Upload
                </button>
                <button className={styles.trackFuncBtn} onClick={() => setIsPlaylistModalOpen(true)}>
                  <PlusCircle size={14} />
                  Create
                </button>

                <div className={styles.searchExpandWrap}>
                  <button
                    className={styles.trackFuncBtn}
                    onClick={() => {
                      if (isSearchExpanded) {
                        setTrackSearch('');
                      }
                      setIsSearchExpanded((prev) => !prev);
                      setTrackIndex(0);
                    }}
                  >
                    <Search size={14} />
                    Search
                  </button>
                  {isSearchExpanded && (
                    <input
                      ref={searchInputRef}
                      className={styles.trackSearchInputExpand}
                      placeholder="Search track"
                      value={trackSearch}
                      onChange={(e) => {
                        setTrackSearch(e.target.value);
                        setTrackIndex(0);
                      }}
                    />
                  )}
                </div>
              </div>

              {playlists.length > 0 && (
                <div className={styles.playlistTargetRow}>
                  <label>Playlist:</label>
                  <select
                    value={activePlaylistId}
                    onChange={(e) => {
                      setActivePlaylistId(e.target.value);
                      setTrackIndex(0);
                    }}
                    className={styles.playlistTargetSelect}
                  >
                    <option value="all">Library</option>
                    {playlists.map((playlist) => (
                      <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {activePlaylistId === 'all' && playlists.length > 0 && (
                <div className={styles.playlistTargetRow}>
                  <label>Add tracks to:</label>
                  <select value={playlistTargetId} onChange={(e) => setPlaylistTargetId(e.target.value)} className={styles.playlistTargetSelect}>
                    {playlists.map((playlist) => (
                      <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.trackRows}>
                {visibleTracks.length === 0 ? (
                  <p className={styles.libraryEmpty}>No tracks in this list yet.</p>
                ) : (
                  visibleTracks.map((sound, index) => (
                    <button
                      key={sound.id}
                      className={`${styles.trackRow} ${index === trackIndex ? styles.trackRowActive : ''}`}
                      onClick={() => {
                        setTrackIndex(index);
                        setIsTrackPlaying(true);
                        setActiveSound('lofi');
                      }}
                    >
                      <div className={styles.trackRowLeft}>
                        <span className={styles.trackRowIndex}>{(index + 1).toString().padStart(2, '0')}</span>
                        <span className={styles.trackRowTitle}>{sound.name}</span>
                      </div>
                      <div className={styles.trackRowActions}>
                        <span className={styles.trackRowDuration}>{formatDuration(trackDurations[sound.id])}</span>
                        {activePlaylistId === 'all' && playlistTargetId && (
                          <span
                            className={styles.trackRowAddBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              addTrackToPlaylist(sound.id);
                            }}
                          >
                            +
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {isPlaylistModalOpen && (
                <div className={styles.playlistModalBackdrop} onClick={() => setIsPlaylistModalOpen(false)}>
                  <div className={styles.playlistModal} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.playlistModalHeader}>
                      <h4>Create Playlist</h4>
                      <button className={styles.playlistModalCloseBtn} onClick={() => setIsPlaylistModalOpen(false)}>
                        <X size={14} />
                      </button>
                    </div>
                    <input
                      className={styles.playlistInput}
                      placeholder="Playlist name"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                    />
                    <button className={styles.playlistCreateBtn} onClick={createPlaylist}>
                      <PlusCircle size={14} />
                      Save Playlist
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
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
