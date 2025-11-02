'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { TableSession } from '@prisma/client';

interface SessionClientProps {
  session: TableSession;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_QUEUE_SOCKET_URL ?? 'http://localhost:4010';
const AD_DURATION_MS = 180_000;
const SESSION_DURATION_MS = 120 * 60 * 1000;

function formatSeconds(value: number): string {
  if (value <= 0) {
    return '00:00';
  }
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function SessionClient({ session }: SessionClientProps) {
  const [status, setStatus] = useState(session.status);
  const [startedAt, setStartedAt] = useState<Date | null>(session.startedAt ? new Date(session.startedAt) : null);
  const [closedAt, setClosedAt] = useState<Date | null>(session.closedAt ? new Date(session.closedAt) : null);
  const [adSeconds, setAdSeconds] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(session.durationMinutes);
  const timersInitialized = useRef(false);

  const adTarget = useMemo(() => {
    const base = new Date(session.createdAt).getTime();
    if (startedAt) {
      return startedAt.getTime();
    }
    return base + AD_DURATION_MS;
  }, [session.createdAt, startedAt]);

  const sessionTarget = useMemo(() => {
    if (closedAt) {
      return closedAt.getTime();
    }
    const base = startedAt ? startedAt.getTime() : adTarget;
    return base + SESSION_DURATION_MS;
  }, [adTarget, closedAt, startedAt]);

  useEffect(() => {
    const now = Date.now();
    if (status === 'LOADING') {
      setAdSeconds(Math.max(0, Math.ceil((adTarget - now) / 1000)));
    } else {
      setAdSeconds(0);
    }
    if (status !== 'CLOSED') {
      setSessionSeconds(Math.max(0, Math.ceil((sessionTarget - now) / 1000)));
    } else {
      setSessionSeconds(0);
    }
  }, [status, adTarget, sessionTarget]);

  useEffect(() => {
    if (timersInitialized.current) {
      return;
    }
    timersInitialized.current = true;
    const interval = window.setInterval(() => {
      setAdSeconds((value) => Math.max(0, value - 1));
      setSessionSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (adSeconds === 0 && status === 'LOADING') {
      setStatus('ACTIVE');
      const now = new Date();
      setStartedAt(now);
      setDurationMinutes(0);
    }
  }, [adSeconds, status]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const socket = io(SOCKET_URL);

    socket.on('adStart', ({ sessionId, seconds }: { sessionId: string; seconds: number }) => {
      if (sessionId === session.id) {
        setStatus('LOADING');
        setStartedAt(null);
        setClosedAt(null);
        setAdSeconds(seconds);
        setSessionSeconds(seconds + SESSION_DURATION_MS / 1000);
      }
    });

    socket.on('tableClosed', ({ sessionId }: { sessionId: string }) => {
      if (sessionId === session.id) {
        setStatus('CLOSED');
        const closed = new Date();
        setClosedAt(closed);
        setSessionSeconds(0);
        if (startedAt) {
          const diff = Math.max(120, Math.round((closed.getTime() - startedAt.getTime()) / 60000));
          setDurationMinutes(diff);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [session]);

  return (
    <div className="space-y-6 rounded-lg border border-slate-800 bg-slate-900/50 p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Scenario {session.scenarioCode}</h1>
          <p className="text-sm text-slate-300">Session ID: {session.id}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            status === 'LOADING'
              ? 'bg-amber-500/20 text-amber-300'
              : status === 'ACTIVE'
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-slate-700/60 text-slate-300'
          }`}
        >
          {status}
        </span>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase text-slate-400">Dungeon Master</h2>
          <p className="mt-2 text-lg text-slate-200">{session.dmId}</p>
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase text-slate-400">Players</h2>
          <ul className="mt-2 space-y-1 text-slate-200">
            {session.playerIds.map((playerId) => (
              <li key={playerId} className="text-sm">
                {playerId}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase text-slate-400">Ad Countdown</h2>
          <p className="mt-2 text-3xl font-bold text-amber-300">{formatSeconds(adSeconds)}</p>
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase text-slate-400">Session Ends In</h2>
          <p className="mt-2 text-3xl font-bold text-emerald-300">{formatSeconds(sessionSeconds)}</p>
        </div>
      </section>

      <section className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-sm font-semibold uppercase text-slate-400">Characters</h2>
        <ul className="mt-2 space-y-1 text-slate-200">
          {session.characterIds.map((characterId) => (
            <li key={characterId} className="text-sm">
              {characterId}
            </li>
          ))}
        </ul>
      </section>

      {closedAt ? (
        <section className="rounded-md border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
          <p>Table closed at {closedAt.toLocaleString()}.</p>
          <p className="mt-1">Runtime: {durationMinutes} minutes.</p>
        </section>
      ) : null}
    </div>
  );
}
