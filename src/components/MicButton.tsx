'use client';

import { useState, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface MicButtonProps {
  onTranscription: (text: string) => void;
}

export default function MicButton({ onTranscription }: MicButtonProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());

        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', blob, 'audio.' + (mimeType === 'audio/webm' ? 'webm' : 'mp4'));

          const res = await fetch('/api/deepgram/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            onTranscription(data.text || '');
          }
        } catch (err) {
          console.error('Transcription error:', err);
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Could not access microphone. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  if (!navigator.mediaDevices?.getUserMedia) return null;

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      disabled={transcribing}
      title={recording ? 'Stop recording' : 'Start recording'}
      style={{
        padding: '7px 14px',
        borderRadius: '999px',
        fontSize: '13px',
        fontWeight: 700,
        border: recording ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(88,204,2,0.3)',
        color: recording ? '#ef4444' : '#58cc02',
        background: recording ? 'rgba(239,68,68,0.12)' : 'rgba(88,204,2,0.12)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        cursor: transcribing ? 'wait' : 'pointer',
        transition: 'all 0.16s ease',
      }}
    >
      {transcribing ? (
        <>
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          Transcribing...
        </>
      ) : recording ? (
        <>
          <MicOff size={13} />
          Stop
        </>
      ) : (
        <>
          <Mic size={13} />
          Record
        </>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
