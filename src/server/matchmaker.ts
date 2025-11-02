import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '@/lib/db/client';
import type { QueueEntry, TableSession } from '@prisma/client';
import { characterSchema, type CharacterInput } from '@/lib/validators/character';

export interface MatchmakerOptions {
  intervalMs: number;
  adDurationMs: number;
  sessionDurationMs: number;
}

const DEFAULT_OPTIONS: MatchmakerOptions = {
  intervalMs: 3000,
  adDurationMs: 180_000,
  sessionDurationMs: 120 * 60 * 1000
};

interface MatchmakerController {
  stop: () => void;
  options: MatchmakerOptions;
}

let controller: MatchmakerController | null = null;
const lifecycleTimers = new Map<string, { ad?: NodeJS.Timeout; close?: NodeJS.Timeout }>();

export type FormCandidateTableResult =
  | { ok: true; dm: QueueEntry; players: QueueEntry[] }
  | { ok: false; reason: 'blocked' | 'ineligible' | 'insufficient' };

export interface MatchValidator {
  isBlocked(dm: QueueEntry, player: QueueEntry): boolean | Promise<boolean>;
  isEligible(player: QueueEntry, scenarioCode: string): boolean | Promise<boolean>;
}

class DefaultValidator implements MatchValidator {
  async isBlocked(): Promise<boolean> {
    return false;
  }

  async isEligible(player: QueueEntry, scenarioCode: string): Promise<boolean> {
    if (!player.characterId || !scenarioCode) {
      return false;
    }
    const result = await validateMatchEligibility(player.characterId);
    return result;
  }
}

const validator = new DefaultValidator();

export async function startMatchmaker(
  io: SocketIOServer,
  overrides?: Partial<MatchmakerOptions>
): Promise<MatchmakerController> {
  if (controller) {
    return controller;
  }
  const options: MatchmakerOptions = { ...DEFAULT_OPTIONS, ...overrides };
  const interval = setInterval(() => {
    void runMatchmaker(io, options);
  }, options.intervalMs);
  void runMatchmaker(io, options);

  controller = {
    options,
    stop: () => {
      clearInterval(interval);
      for (const timers of lifecycleTimers.values()) {
        if (timers.ad) {
          clearTimeout(timers.ad);
        }
        if (timers.close) {
          clearTimeout(timers.close);
        }
      }
      lifecycleTimers.clear();
      controller = null;
    }
  };

  return controller;
}

export function stopMatchmaker(): void {
  controller?.stop();
}

export async function runMatchmaker(io: SocketIOServer, options: MatchmakerOptions): Promise<void> {
  const dms = await prisma.queueEntry.findMany({
    where: { dm: true, status: 'WAITING' },
    orderBy: { createdAt: 'asc' }
  });
  if (!dms.length) {
    return;
  }

  let players = await prisma.queueEntry.findMany({
    where: { dm: false, status: 'WAITING' },
    orderBy: { createdAt: 'asc' }
  });
  if (!players.length) {
    return;
  }

  for (const dm of dms) {
    const result = await formCandidateTable(dm, players, validator);
    if (!result.ok) {
      continue;
    }
    const matchedPlayers = result.players;
    const matchedPlayerIds = new Set(matchedPlayers.map((player) => player.id));
    players = players.filter((player) => !matchedPlayerIds.has(player.id));

    const session = await prisma.$transaction(async (tx) => {
      const createdSession = await tx.tableSession.create({
        data: {
          dmId: dm.userId,
          scenarioCode: dm.scenarioCode ?? 'UNKNOWN',
          playerIds: matchedPlayers.map((player) => player.userId),
          characterIds: matchedPlayers
            .map((player) => player.characterId)
            .filter((id): id is string => Boolean(id)),
          status: 'LOADING'
        }
      });

      await tx.queueEntry.update({
        where: { id: dm.id },
        data: { status: 'MATCHED' }
      });
      await tx.queueEntry.updateMany({
        where: { id: { in: matchedPlayers.map((player) => player.id) } },
        data: { status: 'MATCHED' }
      });

      return createdSession;
    });

    io.emit('tableCreated', session);
    io.emit('adStart', { sessionId: session.id, seconds: Math.floor(options.adDurationMs / 1000) });
    await emitQueueCounts(io);
    scheduleLifecycle(io, session, options);
  }
}

export async function emitQueueCounts(io: SocketIOServer): Promise<void> {
  const [waitingPlayers, waitingDMs] = await Promise.all([
    prisma.queueEntry.count({ where: { dm: false, status: 'WAITING' } }),
    prisma.queueEntry.count({ where: { dm: true, status: 'WAITING' } })
  ]);

  io.emit('queueUpdate', { waitingPlayers, waitingDMs });
}

export async function formCandidateTable(
  dm: QueueEntry,
  players: QueueEntry[],
  validator: MatchValidator
): Promise<FormCandidateTableResult> {
  if (!dm.scenarioCode) {
    return { ok: false, reason: 'insufficient' };
  }

  const selected: QueueEntry[] = [];
  let blocked = false;
  let ineligible = false;

  for (const player of players) {
    if (player.dm || player.status !== 'WAITING' || !player.characterId) {
      continue;
    }

    if (await validator.isBlocked(dm, player)) {
      blocked = true;
      continue;
    }
    if (!(await validator.isEligible(player, dm.scenarioCode))) {
      ineligible = true;
      continue;
    }

    selected.push(player);
    if (selected.length === 4) {
      return { ok: true, dm, players: selected };
    }
  }

  if (blocked) {
    return { ok: false, reason: 'blocked' };
  }
  if (ineligible) {
    return { ok: false, reason: 'ineligible' };
  }
  return { ok: false, reason: 'insufficient' };
}

function scheduleLifecycle(io: SocketIOServer, session: TableSession, options: MatchmakerOptions) {
  const existing = lifecycleTimers.get(session.id) ?? {};
  if (existing.ad) {
    clearTimeout(existing.ad);
  }
  if (existing.close) {
    clearTimeout(existing.close);
  }

  const adTimer = setTimeout(async () => {
    const startedAt = new Date();
    await prisma.tableSession.update({
      where: { id: session.id },
      data: {
        status: 'ACTIVE',
        startedAt
      }
    });

    const closeTimer = setTimeout(async () => {
      const closedAt = new Date();
      const record = await prisma.tableSession.update({
        where: { id: session.id },
        data: {
          status: 'CLOSED',
          closedAt,
          durationMinutes: Math.max(
            120,
            Math.round((closedAt.getTime() - startedAt.getTime()) / 60000)
          )
        }
      });
      io.emit('tableClosed', { sessionId: record.id });
      lifecycleTimers.delete(session.id);
    }, options.sessionDurationMs);

    const currentTimers = lifecycleTimers.get(session.id) ?? {};
    lifecycleTimers.set(session.id, { ...currentTimers, close: closeTimer });
  }, options.adDurationMs);

  lifecycleTimers.set(session.id, { ad: adTimer });
}

async function validateMatchEligibility(characterId: string): Promise<boolean> {
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character) {
    return false;
  }

  const input: CharacterInput = {
    name: character.name,
    level: character.level,
    ancestry: character.ancestry,
    background: character.background,
    clazz: character.clazz,
    subclass: character.subclass ?? undefined,
    heritage: character.heritage ?? undefined,
    keyAbility: character.keyAbility as CharacterInput['keyAbility'],
    abilities: character.abilities as CharacterInput['abilities'],
    skills: Array.isArray(character.skills) ? (character.skills as string[]) : [],
    feats: Array.isArray(character.feats)
      ? (character.feats as CharacterInput['feats'])
      : [],
    spells: Array.isArray(character.spells)
      ? (character.spells as CharacterInput['spells'])
      : [],
    gear: Array.isArray(character.gear) ? (character.gear as CharacterInput['gear']) : [],
    companions: Array.isArray((character as any).companions)
      ? ((character as any).companions as CharacterInput['companions'])
      : []
  };

  const parsed = characterSchema.safeParse(input);
  return parsed.success;
}
