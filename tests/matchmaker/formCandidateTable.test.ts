import { describe, expect, it, vi } from 'vitest';
import type { QueueEntry } from '@prisma/client';
import { formCandidateTable, type MatchValidator } from '@/server/matchmaker';

function createEntry(id: string, overrides: Partial<QueueEntry> = {}): QueueEntry {
  return {
    id,
    userId: `user-${id}`,
    dm: false,
    scenarioCode: null,
    characterId: `char-${id}`,
    status: 'WAITING',
    createdAt: new Date(),
    ...overrides
  } as QueueEntry;
}

describe('formCandidateTable', () => {
  it('returns four eligible players for a dm', async () => {
    const dm = createEntry('dm', { dm: true, scenarioCode: 'PFS-01-01', characterId: null });
    const players = Array.from({ length: 4 }, (_, index) =>
      createEntry(`player-${index}`, { characterId: `character-${index}` })
    );
    const validator: MatchValidator = {
      isBlocked: vi.fn().mockResolvedValue(false),
      isEligible: vi.fn().mockResolvedValue(true)
    };

    const result = await formCandidateTable(dm, players, validator);

    expect(result).toEqual({ ok: true, dm, players });
    expect(validator.isBlocked).toHaveBeenCalledTimes(4);
    expect(validator.isEligible).toHaveBeenCalledTimes(4);
  });

  it('fails when a player is blocked', async () => {
    const dm = createEntry('dm', { dm: true, scenarioCode: 'PFS-02-01', characterId: null });
    const players = Array.from({ length: 4 }, (_, index) =>
      createEntry(`player-${index}`, { characterId: `character-${index}` })
    );

    const validator: MatchValidator = {
      isBlocked: vi.fn().mockImplementation(async (_dm, player) => player.id === 'player-1'),
      isEligible: vi.fn().mockResolvedValue(true)
    };

    const result = await formCandidateTable(dm, players, validator);

    expect(result).toEqual({ ok: false, reason: 'blocked' });
    expect(validator.isEligible).toHaveBeenCalledTimes(3);
  });

  it('fails when insufficient eligible players are available', async () => {
    const dm = createEntry('dm', { dm: true, scenarioCode: 'PFS-03-01', characterId: null });
    const players = Array.from({ length: 4 }, (_, index) =>
      createEntry(`player-${index}`, { characterId: `character-${index}` })
    );

    const validator: MatchValidator = {
      isBlocked: vi.fn().mockResolvedValue(false),
      isEligible: vi.fn().mockImplementation(async (_player, _scenario) => {
        return _player.id !== 'player-3';
      })
    };

    const result = await formCandidateTable(dm, players, validator);

    expect(result).toEqual({ ok: false, reason: 'ineligible' });
    expect(validator.isBlocked).toHaveBeenCalledTimes(4);
  });
});
