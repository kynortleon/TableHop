import { z } from 'zod';

export const abilityScoreSchema = z.object({
  STR: z.number().min(8).max(18),
  DEX: z.number().min(8).max(18),
  CON: z.number().min(8).max(18),
  INT: z.number().min(8).max(18),
  WIS: z.number().min(8).max(18),
  CHA: z.number().min(8).max(18)
});

export const characterSchema = z
  .object({
    name: z.string().min(1),
    level: z.number().int().min(1).max(20),
    ancestry: z.string().min(1),
    background: z.string().min(1),
    clazz: z.string().min(1),
    subclass: z.string().optional(),
    heritage: z.string().optional(),
    keyAbility: z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']),
    abilities: abilityScoreSchema,
    skills: z.array(z.string()).max(18),
    feats: z
      .array(
        z.object({
          key: z.string(),
          level: z.number().int().min(1).max(20)
        })
      )
      .max(30),
    spells: z
      .array(
        z.object({
          key: z.string(),
          level: z.number().int().min(0).max(10)
        })
      )
      .max(100),
    gear: z
      .array(
        z.object({
          key: z.string(),
          quantity: z.number().int().min(1).max(20),
          totalCost: z.number().min(0)
        })
      )
      .max(60),
    companions: z
      .array(
        z.object({
          key: z.string().optional(),
          type: z.enum(['animal', 'familiar', 'eidolon']),
          name: z.string().min(1).optional(),
          source: z.string().min(1).optional()
        })
      )
      .max(3)
  })
  .superRefine((values, ctx) => {
    const total = Object.values(values.abilities).reduce((acc, stat) => acc + stat, 0);
    if (total > 90) {
      ctx.addIssue({
        path: ['abilities'],
        code: z.ZodIssueCode.custom,
        message: 'Ability score total exceeds point-buy allowance.'
      });
    }
  });

export type CharacterInput = z.infer<typeof characterSchema>;
