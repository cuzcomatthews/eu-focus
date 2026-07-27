'use client';

import { useCallback, useEffect, useState } from 'react';

interface PersistedTimer {
  phase: string;
  startTimestamp: number | null;
  totalTime: number;
  taskId: string | null;
  taskTitle: string | null;
  isPaused: boolean;
  pausedRemaining: number;
}

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
    };
  }
}

let pipWindow: Window | null = null;
let pipInterval: number | null = null;
let pipListeners: Array<(open: boolean) => void> = [];

function notify(open: boolean) {
  pipListeners.forEach((fn) => fn(open));
}

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(seconds, 0) / 60).toString().padStart(2, '0');
  const s = (Math.max(seconds, 0) % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function injectPipContent(doc: Document) {
  doc.title = 'EU FOCUS Timer';
  doc.head.innerHTML = `<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#191919;color:#ECECEC;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;user-select:none}
.phase{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;padding:4px 10px;border-radius:999px;margin-bottom:6px}
.pf{background:rgba(88,204,2,0.14);color:#58cc02}
.pb{background:rgba(28,176,246,0.12);color:#1cb0f6}
.pi{background:rgba(100,116,139,0.15);color:#9B9A97}
.time{font-size:48px;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:-0.03em;line-height:1}
.tf{color:#58cc02}
.tb{color:#1cb0f6}
.ti{color:rgba(255,255,255,0.5)}
.task{font-size:11px;color:#9B9A97;margin-top:6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center}
.s{width:60px;height:60px;margin-bottom:6px}
.s circle{fill:none;stroke-width:4}
.s .b{stroke:rgba(255,255,255,0.08)}
.s .ff{stroke:#58cc02;filter:drop-shadow(0 0 4px rgba(88,204,2,0.35))}
.s .fb{stroke:#1cb0f6;filter:drop-shadow(0 0 4px rgba(28,176,246,0.34))}
</style>`;
  doc.body.innerHTML = `
<svg class="s" viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" class="b"/>
<circle id="pp" cx="30" cy="30" r="26" class="ff" stroke-dasharray="163.36" stroke-dashoffset="0" transform="rotate(-90 30 30)"/></svg>
<div id="pph" class="phase pi">Ready</div>
<div id="ppt" class="time ti">25:00</div>
<div id="ppt2" class="task"></div>`;
}

function updatePipTimer() {
  if (!pipWindow) return;
  const doc = pipWindow.document;
  try {
    const stored = localStorage.getItem('eu-focus-timer');
    if (!stored) {
      doc.getElementById('pph')!.textContent = 'Ready';
      doc.getElementById('ppt')!.textContent = '25:00';
      doc.getElementById('ppt')!.className = 'time ti';
      doc.getElementById('pph')!.className = 'phase pi';
      doc.getElementById('pp')!.setAttribute('stroke-dashoffset', '163.36');
      doc.getElementById('pp')!.setAttribute('class', 'ff');
      doc.getElementById('ppt2')!.textContent = '';
      return;
    }
    const data: PersistedTimer = JSON.parse(stored);
    const now = Date.now();
    let remaining: number;
    let phase = data.phase;
    if (data.isPaused) {
      remaining = data.pausedRemaining;
    } else if (data.startTimestamp) {
      const elapsed = Math.floor((now - data.startTimestamp) / 1000);
      remaining = data.totalTime - elapsed;
      if (remaining <= 0) { phase = 'idle'; remaining = 0; }
    } else {
      remaining = data.totalTime || 1500;
      phase = 'idle';
    }
    doc.getElementById('ppt')!.textContent = formatTime(remaining);
    doc.getElementById('ppt2')!.textContent = data.taskTitle || '';
    if (phase === 'focus') {
      doc.getElementById('pph')!.textContent = 'Focus';
      doc.getElementById('pph')!.className = 'phase pf';
      doc.getElementById('ppt')!.className = 'time tf';
      const pct = data.totalTime > 0 ? Math.max(remaining, 0) / data.totalTime : 0;
      doc.getElementById('pp')!.setAttribute('stroke-dashoffset', `${163.36 * pct}`);
      doc.getElementById('pp')!.setAttribute('class', 'ff');
    } else if (phase === 'break') {
      doc.getElementById('pph')!.textContent = 'Break';
      doc.getElementById('pph')!.className = 'phase pb';
      doc.getElementById('ppt')!.className = 'time tb';
      const pct = data.totalTime > 0 ? Math.max(remaining, 0) / data.totalTime : 0;
      doc.getElementById('pp')!.setAttribute('stroke-dashoffset', `${163.36 * pct}`);
      doc.getElementById('pp')!.setAttribute('class', 'fb');
    } else {
      doc.getElementById('pph')!.textContent = 'Ready';
      doc.getElementById('pph')!.className = 'phase pi';
      doc.getElementById('ppt')!.className = 'time ti';
      doc.getElementById('pp')!.setAttribute('stroke-dashoffset', '163.36');
      doc.getElementById('pp')!.setAttribute('class', 'ff');
    }
  } catch { /* ignore */ }
}

export function usePiPTimer() {
  const [isOpen, setIsOpen] = useState(pipWindow !== null);
  const supported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  useEffect(() => {
    const listener = (open: boolean) => setIsOpen(open);
    pipListeners.push(listener);
    return () => { pipListeners = pipListeners.filter((l) => l !== listener); };
  }, []);
  const open = useCallback(async () => {
    if (!supported || pipWindow) return;
    try {
      const w = await window.documentPictureInPicture!.requestWindow({ width: 280, height: 200 });
      pipWindow = w;
      notify(true);
      injectPipContent(w.document);
      updatePipTimer();
      pipInterval = window.setInterval(updatePipTimer, 500);
      w.addEventListener('pagehide', () => {
        if (pipInterval !== null) { clearInterval(pipInterval); pipInterval = null; }
        pipWindow = null;
        notify(false);
      });
    } catch { pipWindow = null; notify(false); }
  }, [supported]);
  const close = useCallback(() => {
    if (pipWindow) { pipWindow.close(); pipWindow = null; }
    if (pipInterval !== null) { clearInterval(pipInterval); pipInterval = null; }
    notify(false);
  }, []);
  useEffect(() => {
    return () => { if (pipWindow) { pipWindow.close(); pipWindow = null; }
    if (pipInterval !== null) { clearInterval(pipInterval); pipInterval = null; } };
  }, []);
  return { supported, isOpen, open, close };
}