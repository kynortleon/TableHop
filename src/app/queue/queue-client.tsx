'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import type { QueueEntry, TableSession } from '@prisma/client';
import { PreSessionAd } from '@/components/pre-session-ad';

interface CharacterSummary {
  id: string;
  name: string;
  level: number;
  clazz: string;
}

interface QueueClientProps {
  characters: CharacterSummary[];
}

interface QueueCounts {
  waitingPlayers: number;
  waitingDMs: number;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_QUEUE_SOCKET_URL ?? 'http://localhost:4010';
const DEFAULT_COUNTS: QueueCounts = { waitingPlayers: 0, waitingDMs: 0 };

export default function QueueClient({ characters }: QueueClientProps) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [counts, setCounts] = useState<QueueCounts>(DEFAULT_COUNTS);
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [scenarioCode, setScenarioCode] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [adOpen, setAdOpen] = useState(false);
  const [adComplete, setAdComplete] = useState(false);
  const [pendingSession, setPendingSession] = useState<TableSession | null>(null);
  const pendingSessionRef = useRef<TableSession | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = window.localStorage.getItem('tablehop:userId');
    if (stored) {
      setUserId(stored);
      return;
    }
    const generated = crypto.randomUUID();
    window.localStorage.setItem('tablehop:userId', generated);
    setUserId(generated);
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }
    fetch('/api/queue/status', {
      headers: {
        'x-user-id': userId
      }
    })
      .then((response) => response.json())
      .then((data) => {
        setCounts({
          waitingPlayers: data.waitingPlayers ?? 0,
          waitingDMs: data.waitingDMs ?? 0
        });
        setEntry(data.entry ?? null);
        if (data.entry?.characterId) {
          setCharacterId(data.entry.characterId);
        }
        if (data.entry?.scenarioCode) {
          setScenarioCode(data.entry.scenarioCode);
        }
      })
      .catch(() => {
        setCounts(DEFAULT_COUNTS);
      });
  }, [userId]);

  useEffect(() => {
    pendingSessionRef.current = pendingSession;
  }, [pendingSession]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const socketInstance = io(SOCKET_URL, {
      query: { userId }
    });

    socketInstance.on('queueUpdate', (payload: QueueCounts) => {
      setCounts(payload);
    });

    socketInstance.on('joinedQueue', (queueEntry: QueueEntry) => {
      if (queueEntry.userId === userId) {
        setEntry(queueEntry);
      }
    });

    socketInstance.on('tableCreated', (session: TableSession) => {
      if (session.dmId === userId || session.playerIds.includes(userId)) {
        setPendingSession(session);
        setAdOpen(true);
        setAdComplete(false);
      }
    });

    socketInstance.on('adStart', ({ sessionId }: { sessionId: string; seconds: number }) => {
      const current = pendingSessionRef.current;
      if (current && current.id === sessionId) {
        setAdOpen(true);
        setAdComplete(false);
      }
    });

    socketInstance.on('tableClosed', ({ sessionId }: { sessionId: string }) => {
      const current = pendingSessionRef.current;
      if (current && current.id === sessionId) {
        setPendingSession((value) =>
          value ? { ...value, status: 'CLOSED', closedAt: new Date().toISOString() } : value
        );
        setAdOpen(false);
      }
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [userId]);

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === characterId) ?? null,
    [characters, characterId]
  );

  const joinQueue = async (payload: { dm: boolean; scenarioCode?: string; characterId?: string }) => {
    if (!userId) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/queue/join', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error('Failed to join queue');
      }
      const data = await response.json();
      setEntry(data.entry);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const leaveQueue = async () => {
    if (!userId) {
      return;
    }
    setLoading(true);
    try {
      await fetch('/api/queue/leave', {
        method: 'POST',
        headers: {
          'x-user-id': userId
        }
      });
      setEntry(null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <header className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 shadow">
        <h1 className="text-3xl font-bold">Realtime Table Queue</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Join the player queue with a prepared Pathfinder Society character or host a table as a Dungeon Master.
          When a table is ready you&apos;ll watch a short pre-session ad before launching the virtual table.
        </p>
        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Waiting Players</dt>
            <dd className="text-2xl font-semibold text-emerald-400">{counts.waitingPlayers}</dd>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Waiting DMs</dt>
            <dd className="text-2xl font-semibold text-amber-300">{counts.waitingDMs}</dd>
          </div>
        </dl>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold">Players</h2>
          <p className="text-sm text-slate-300">Choose a Pathfinder Society character to join a table.</p>
          <select
            className="w-full rounded border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm"
            value={characterId}
            onChange={(event) => setCharacterId(event.target.value)}
          >
            <option value="">Select character</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name} · Level {character.level} {character.clazz}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <button
              className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-800/60"
              onClick={() => joinQueue({ dm: false, characterId })}
              disabled={!characterId || loading}
            >
              Join Queue
            </button>
            <button
              className="rounded border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={leaveQueue}
              disabled={loading || !entry}
            >
              Leave Queue
            </button>
          </div>
          {selectedCharacter ? (
            <p className="text-xs text-slate-400">
              Queuing as <span className="font-semibold text-slate-200">{selectedCharacter.name}</span>.
            </p>
          ) : entry?.characterId ? (
            <p className="text-xs text-slate-400">
              Waiting with saved character <span className="font-semibold text-slate-200">{entry.characterId}</span>.
            </p>
          ) : null}
        </div>

        <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold">Dungeon Masters</h2>
          <p className="text-sm text-slate-300">Host a new table by entering a scenario code.</p>
          <input
            className="w-full rounded border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm"
            placeholder="Scenario code (e.g. PFS-02-01)"
            value={scenarioCode}
            onChange={(event) => setScenarioCode(event.target.value)}
          />
          <div className="flex items-center gap-3">
            <button
              className="rounded bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-amber-700/60"
              onClick={() => joinQueue({ dm: true, scenarioCode })}
              disabled={!scenarioCode || loading}
            >
              Host Table
            </button>
            <button
              className="rounded border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={leaveQueue}
              disabled={loading || !entry}
            >
              Leave Queue
            </button>
          </div>
          {entry?.dm && entry.scenarioCode ? (
            <p className="text-xs text-slate-400">
              Hosting scenario <span className="font-semibold text-slate-200">{entry.scenarioCode}</span>.
            </p>
          ) : null}
        </div>
      </section>

      {adOpen && pendingSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
          <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-50">Table Ready</h3>
            <p className="mt-2 text-sm text-slate-300">
              Your group is assembled for scenario <span className="font-semibold">{pendingSession.scenarioCode}</span>.
              Watch the sponsored pre-session ad to unlock the Launch Table button.
            </p>
            <div className="mt-6">
              <PreSessionAd key={pendingSession.id} onComplete={() => setAdComplete(true)} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  setAdOpen(false);
                  setPendingSession(null);
                  setAdComplete(false);
                }}
              >
                Close
              </button>
              <button
                className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-primary/60"
                onClick={() => {
                  if (pendingSession) {
                    router.push(`/session/${pendingSession.id}`);
                  }
                }}
                disabled={!adComplete}
              >
                Launch Table
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
