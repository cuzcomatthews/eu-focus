'use client';

import { useCallback } from 'react';

// A simple Web Audio API wrapper to generate SFX without needing external files
export function useSoundEffects() {
  const playTone = useCallback((frequency: number, type: OscillatorType, duration: number, volume = 0.1) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      
      gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.error('Audio playback failed', e);
    }
  }, []);

  const playPop = useCallback(() => {
    playTone(600, 'sine', 0.1, 0.2); // Short pleasant pop for clicks/interactions
  }, [playTone]);

  const playSuccess = useCallback(() => {
    // A gamified "Ding-Ding!" success sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playFreq = (freq: number, startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = audioCtx.currentTime;
      playFreq(523.25, now, 0.2);       // C5
      playFreq(659.25, now + 0.15, 0.3); // E5
      playFreq(783.99, now + 0.3, 0.4);  // G5
    } catch (e) {
      console.error(e);
    }
  }, []);

  const playAlert = useCallback(() => {
    playTone(440, 'triangle', 0.5, 0.3); // Alert/notification sound
  }, [playTone]);

  return { playPop, playSuccess, playAlert };
}
