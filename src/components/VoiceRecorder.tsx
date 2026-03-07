// ============================================
// VoiceRecorder — Hold-to-record button
// Uses the browser's MediaRecorder API
// ============================================

import { useState, useRef } from 'react';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
}

export default function VoiceRecorder({ onRecordingComplete }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(blob);
        setHasRecording(true);
        // Stop all tracks so the mic indicator goes away
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Could not access microphone. Please allow microphone access and try again.');
      console.error('Microphone error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Voice Recording (optional)
      </label>
      <button
        type="button"
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        className={`w-full py-4 px-6 rounded-lg border-2 border-dashed text-center cursor-pointer transition-colors ${
          isRecording
            ? 'border-red-500 bg-red-50 text-red-700'
            : hasRecording
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-300 bg-gray-50 text-gray-600 hover:border-blue-400'
        }`}
        aria-label={isRecording ? 'Release to stop recording' : 'Hold to record voice note'}
      >
        {isRecording
          ? '🔴 Recording... Release to stop'
          : hasRecording
            ? '✅ Voice recorded — Hold again to re-record'
            : '🎤 Hold to record voice note'}
      </button>
    </div>
  );
}
