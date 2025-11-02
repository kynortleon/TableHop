'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface PreSessionAdProps {
  onComplete?: () => void;
  durationSeconds?: number;
  videoSrc?: string;
}

const DEFAULT_VIDEO = '/ads/pre-session.mp4';

function formatSeconds(value: number): string {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function PreSessionAd({
  onComplete,
  durationSeconds = 180,
  videoSrc = DEFAULT_VIDEO
}: PreSessionAdProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(durationSeconds);
  const [videoError, setVideoError] = useState<string | null>(null);
  const completeRef = useRef(false);

  useEffect(() => {
    setSecondsRemaining(durationSeconds);
    completeRef.current = false;
  }, [durationSeconds]);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      if (!completeRef.current) {
        completeRef.current = true;
        onComplete?.();
      }
      return;
    }
    const timer = window.setInterval(() => {
      setSecondsRemaining((value) => Math.max(0, value - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [secondsRemaining, onComplete]);

  const progress = useMemo(() => {
    if (durationSeconds === 0) {
      return 1;
    }
    return (durationSeconds - secondsRemaining) / durationSeconds;
  }, [durationSeconds, secondsRemaining]);

  return (
    <div className="space-y-4">
      <div className="aspect-video overflow-hidden rounded-lg border border-slate-800 bg-black">
        <video
          key={videoSrc}
          className="h-full w-full object-cover"
          src={videoSrc}
          autoPlay
          muted
          playsInline
          controls={false}
          onError={() => setVideoError('Advertisement failed to load.')}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
          <span>Sponsored Intermission</span>
          <span>{formatSeconds(secondsRemaining)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
        {videoError ? (
          <p className="text-xs text-red-300">{videoError}</p>
        ) : (
          <p className="text-xs text-slate-400">
            Launch controls unlock when the advertisement completes.
          </p>
        )}
      </div>
    </div>
  );
}
