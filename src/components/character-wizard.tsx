'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { CharacterInput } from '@/lib/validators/character';
import { characterSchema } from '@/lib/validators/character';
import type { CatalogEntry } from '@/lib/aon/types';
import type { ValidationIssue, ValidationSummary } from '@/types/pfs';
import { useCatalog } from '@/hooks/useCatalog';
import { Badge } from './ui/badge';

type StepKey = 'identity' | 'abilities' | 'skills' | 'feats' | 'spells' | 'gear' | 'companions';

const steps: Array<{ key: StepKey; label: string }> = [
  { key: 'identity', label: 'Identity' },
  { key: 'abilities', label: 'Abilities' },
  { key: 'skills', label: 'Skills' },
  { key: 'feats', label: 'Feats' },
  { key: 'spells', label: 'Spells' },
  { key: 'gear', label: 'Gear' },
  { key: 'companions', label: 'Companions' }
];

const baseAbilities = {
  STR: 10,
  DEX: 10,
  CON: 10,
  INT: 10,
  WIS: 10,
  CHA: 10
} as const;

const skillList = [
  'Acrobatics',
  'Arcana',
  'Athletics',
  'Crafting',
  'Deception',
  'Diplomacy',
  'Intimidation',
  'Medicine',
  'Nature',
  'Occultism',
  'Performance',
  'Religion',
  'Society',
  'Stealth',
  'Survival',
  'Thievery'
];

const maxSkillChoices = 8;
const abilityBudget = 72;

const fieldToStep: Partial<Record<string, StepKey>> = {
  name: 'identity',
  level: 'identity',
  ancestry: 'identity',
  heritage: 'identity',
  background: 'identity',
  clazz: 'identity',
  keyAbility: 'abilities',
  abilities: 'abilities',
  skills: 'skills',
  feats: 'feats',
  spells: 'spells',
  gear: 'gear',
  companions: 'companions'
};

type CompanionType = 'animal' | 'familiar' | 'eidolon';

const companionTypes: Array<{ type: CompanionType; label: string }> = [
  { type: 'animal', label: 'Animal Companion' },
  { type: 'familiar', label: 'Familiar' },
  { type: 'eidolon', label: 'Eidolon' }
];

export function CharacterWizard() {
  const [currentStep, setCurrentStep] = useState<StepKey>('identity');
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<CharacterInput>({
    name: '',
    level: 1,
    ancestry: '',
    heritage: '',
    background: '',
    clazz: '',
    subclass: '',
    keyAbility: 'STR',
    abilities: { ...baseAbilities },
    skills: [],
    feats: [],
    spells: [],
    gear: [],
    companions: []
  });
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationSummary | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const lastValidationPayload = useRef<string>('');

  const ancestries = useCatalog('ancestries');
  const backgrounds = useCatalog('backgrounds');
  const classes = useCatalog('classes');
  const heritages = useCatalog('heritages');
  const [featSearch, setFeatSearch] = useState('');
  const [spellSearch, setSpellSearch] = useState('');
  const [gearSearch, setGearSearch] = useState('');
  const feats = useCatalog('feats', { q: featSearch, level: form.level });
  const spells = useCatalog('spells', { q: spellSearch, level: form.level });
  const items = useCatalog('items', { q: gearSearch, level: form.level });

  const heritageOptions = useMemo(() => {
    const options = heritages.data ?? [];
    if (!form.ancestry) {
      return options;
    }
    const ancestryKey = form.ancestry.toLowerCase();
    return options.filter((entry) =>
      entry.tags.some((tag) => tag.toLowerCase() === `ancestry:${ancestryKey}`)
    );
  }, [form.ancestry, heritages.data]);

  useEffect(() => {
    if (!form.heritage) {
      return;
    }
    if (!heritageOptions.some((entry) => entry.key === form.heritage)) {
      setForm((prev) => ({ ...prev, heritage: '' }));
    }
  }, [form.heritage, heritageOptions]);

  const totalAbilityScore = useMemo(
    () => Object.values(form.abilities).reduce((acc, score) => acc + score, 0),
    [form.abilities]
  );

  const remainingAbilityPoints = abilityBudget - totalAbilityScore;

  const status: 'unknown' | 'checking' | 'legal' | 'invalid' = useMemo(() => {
    if (isValidating) {
      return 'checking';
    }
    if (!validation) {
      return 'unknown';
    }
    return validation.valid ? 'legal' : 'invalid';
  }, [isValidating, validation]);

  const runValidation = useCallback(
    async (data: CharacterInput, cacheKey?: string) => {
      try {
        setIsValidating(true);
        setValidationError(null);
        const payloadKey = cacheKey ?? JSON.stringify(data);
        lastValidationPayload.current = payloadKey;
        const res = await fetch('/api/characters/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const body = (await res.json()) as ValidationSummary & {
          errors?: ValidationIssue[];
          warnings?: ValidationIssue[];
        };
        const summary: ValidationSummary = {
          valid: Boolean(body.valid),
          errors: body.errors ?? [],
          warnings: body.warnings ?? []
        };
        if (!res.ok) {
          setValidation(summary);
          setValidationError('Validation service returned an error.');
          return summary;
        }
        setValidation(summary);
        return summary;
      } catch (err) {
        setValidationError('Unable to validate character. Please check your connection.');
        return null;
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const parsed = characterSchema.safeParse(form);
      if (!parsed.success) {
        const schemaIssues: ValidationIssue[] = parsed.error.issues.map((issue) => ({
          field: String(issue.path[0] ?? 'form'),
          code: 'SCHEMA',
          message: issue.message
        }));
        setValidation({ valid: false, errors: schemaIssues, warnings: [] });
        setValidationError(null);
        lastValidationPayload.current = '';
        return;
      }
      const payloadKey = JSON.stringify(parsed.data);
      if (payloadKey === lastValidationPayload.current) {
        return;
      }
      runValidation(parsed.data, payloadKey);
    }, 400);
    return () => clearTimeout(timer);
  }, [form, currentStep, runValidation]);

  const updateField = (field: keyof CharacterInput, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateAbility = (ability: keyof typeof baseAbilities, value: number) => {
    setForm((prev) => {
      const nextAbilities = {
        ...prev.abilities,
        [ability]: value
      } as CharacterInput['abilities'];
      const nextTotal = Object.values(nextAbilities).reduce((acc, score) => acc + score, 0);
      if (nextTotal > abilityBudget) {
        return prev;
      }
      return { ...prev, abilities: nextAbilities };
    });
  };

  const toggleSkill = (skill: string) => {
    setForm((prev) => {
      const hasSkill = prev.skills.includes(skill);
      if (hasSkill) {
        return { ...prev, skills: prev.skills.filter((item) => item !== skill) };
      }
      if (prev.skills.length >= maxSkillChoices) {
        return prev;
      }
      return { ...prev, skills: [...prev.skills, skill] };
    });
  };

  const addFeat = (entry: CatalogEntry) => {
    setForm((prev) => ({
      ...prev,
      feats: [...prev.feats, { key: entry.key, level: entry.level }]
    }));
  };

  const removeFeat = (key: string) => {
    setForm((prev) => ({
      ...prev,
      feats: prev.feats.filter((feat) => feat.key !== key)
    }));
  };

  const addSpell = (entry: CatalogEntry) => {
    setForm((prev) => ({
      ...prev,
      spells: [...prev.spells, { key: entry.key, level: entry.level }]
    }));
  };

  const removeSpell = (key: string) => {
    setForm((prev) => ({
      ...prev,
      spells: prev.spells.filter((spell) => spell.key !== key)
    }));
  };

  const addItem = (entry: CatalogEntry) => {
    setForm((prev) => ({
      ...prev,
      gear: [...prev.gear, { key: entry.key, quantity: 1, totalCost: entry.level * 2 }]
    }));
  };

  const removeItem = (key: string) => {
    setForm((prev) => ({
      ...prev,
      gear: prev.gear.filter((item) => item.key !== key)
    }));
  };

  const addCompanion = (type: CompanionType) => {
    setForm((prev) => ({
      ...prev,
      companions: [...prev.companions, { type, name: '', source: '' }]
    }));
  };

  const updateCompanion = (index: number, field: 'name' | 'source', value: string) => {
    setForm((prev) => {
      const next = [...prev.companions];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, companions: next };
    });
  };

  const removeCompanion = (index: number) => {
    setForm((prev) => ({
      ...prev,
      companions: prev.companions.filter((_, idx) => idx !== index)
    }));
  };

  const scrollToStep = (step: StepKey) => {
    const el = document.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const goToStep = (index: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, index));
    const step = steps[clamped].key;
    setCurrentStep(step);
    setTimeout(() => scrollToStep(step), 60);
  };

  const handleIssueNavigate = (issue: ValidationIssue) => {
    const step = fieldToStep[issue.field] ?? 'identity';
    const index = steps.findIndex((item) => item.key === step);
    if (index >= 0) {
      goToStep(index);
    }
  };

  const submit = async () => {
    setError(null);
    const parsed = characterSchema.safeParse(form);
    if (!parsed.success) {
      const schemaIssues: ValidationIssue[] = parsed.error.issues.map((issue) => ({
        field: String(issue.path[0] ?? 'form'),
        code: 'SCHEMA',
        message: issue.message
      }));
      setValidation({ valid: false, errors: schemaIssues, warnings: [] });
      setError('Validation failed. Please check each step for missing information.');
      if (schemaIssues.length > 0) {
        handleIssueNavigate(schemaIssues[0]);
      }
      return;
    }

    const summary = await runValidation(parsed.data);
    if (!summary || !summary.valid) {
      setError('Resolve legality issues before saving.');
      if (summary?.errors?.length) {
        handleIssueNavigate(summary.errors[0]);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data)
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body?.error ?? 'Failed to save character.');
          if (body?.errors) {
            setValidation({ valid: false, errors: body.errors, warnings: body.warnings ?? [] });
          }
          return;
        }
        if (body?.valid) {
          setValidation({ valid: true, errors: [], warnings: body.warnings ?? [] });
        }
        if (body?.id) {
          window.location.href = `/characters/${body.id}`;
        }
      } catch (err) {
        setError('Unexpected error saving character.');
      }
    });
  };

  const errorCount = validation?.errors.length ?? 0;
  const warningCount = validation?.warnings.length ?? 0;

  return (
    <div className="space-y-8">
      <aside className="sticky top-4 z-10 space-y-3 rounded border border-slate-800 bg-slate-950 p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {status === 'legal' && <Badge className="bg-emerald-600">PFS Legal</Badge>}
          {status === 'invalid' && <Badge variant="outline" className="border-red-500 text-red-300">Invalid</Badge>}
          {status === 'checking' && <Badge variant="outline">Validating…</Badge>}
          {status === 'unknown' && <Badge variant="outline">Not evaluated</Badge>}
          <div className="text-xs text-slate-400">
            {isValidating ? 'Checking Pathfinder Society legality…' : `${errorCount} errors · ${warningCount} warnings`}
          </div>
        </div>
        {validationError && <p className="text-xs text-red-300">{validationError}</p>}
        {(errorCount > 0 || warningCount > 0) && (
          <div className="space-y-3 text-xs">
            {errorCount > 0 && (
              <details open className="rounded border border-red-500/40 bg-red-950/40 p-3">
                <summary className="cursor-pointer font-semibold text-red-200">
                  {errorCount} legality issue{errorCount === 1 ? '' : 's'}
                </summary>
                <ul className="mt-2 space-y-2">
                  {validation?.errors.map((issue) => (
                    <li key={`${issue.code}-${issue.message}`} data-validation-field={issue.field} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => handleIssueNavigate(issue)}
                        className="text-left text-red-200 underline decoration-dotted hover:text-red-100"
                      >
                        {issue.message}
                      </button>
                      {issue.url && (
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-[0.65rem] text-red-300 underline"
                        >
                          View on AoN ↗
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {warningCount > 0 && (
              <details className="rounded border border-yellow-400/40 bg-yellow-900/20 p-3">
                <summary className="cursor-pointer font-semibold text-yellow-100">
                  {warningCount} warning{warningCount === 1 ? '' : 's'}
                </summary>
                <ul className="mt-2 space-y-2 text-yellow-100">
                  {validation?.warnings.map((issue) => (
                    <li key={`${issue.code}-${issue.message}`} className="space-y-1">
                      <span>{issue.message}</span>
                      {issue.url && (
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-[0.65rem] text-yellow-200 underline"
                        >
                          Learn more ↗
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </aside>

      <div className="grid gap-3 sm:grid-cols-7">
        {steps.map((step, index) => (
          <button
            key={step.key}
            type="button"
            onClick={() => goToStep(index)}
            className={`rounded border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition ${
              step.key === currentStep
                ? 'border-primary bg-primary/20 text-primary'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-primary/40'
            }`}
          >
            {index + 1}. {step.label}
          </button>
        ))}
      </div>

      <div className="rounded border border-slate-800 bg-slate-950 p-6" data-step={currentStep}>
        {currentStep === 'identity' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3" data-validation-field="name">
              <label className="block text-xs font-semibold uppercase text-slate-400">Name</label>
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-3" data-validation-field="level">
              <label className="block text-xs font-semibold uppercase text-slate-400">Level</label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.level}
                onChange={(event) => updateField('level', Number(event.target.value))}
                className="w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <SelectField
              label="Ancestry"
              field="ancestry"
              value={form.ancestry}
              options={ancestries.data ?? []}
              loading={ancestries.loading}
              error={ancestries.error?.message}
              onChange={(value) => updateField('ancestry', value)}
            />
            <SelectField
              label="Heritage"
              field="heritage"
              value={form.heritage ?? ''}
              options={heritageOptions}
              loading={heritages.loading}
              error={heritages.error?.message}
              onChange={(value) => updateField('heritage', value)}
              placeholder={form.ancestry ? 'Select Heritage' : 'Choose an ancestry first'}
              disabled={!form.ancestry}
            />
            <SelectField
              label="Background"
              field="background"
              value={form.background}
              options={backgrounds.data ?? []}
              loading={backgrounds.loading}
              error={backgrounds.error?.message}
              onChange={(value) => updateField('background', value)}
            />
            <SelectField
              label="Class"
              field="clazz"
              value={form.clazz}
              options={classes.data ?? []}
              loading={classes.loading}
              error={classes.error?.message}
              onChange={(value) => updateField('clazz', value)}
            />
            <div className="space-y-3" data-validation-field="keyAbility">
              <label className="block text-xs font-semibold uppercase text-slate-400">Key Ability</label>
              <select
                value={form.keyAbility}
                onChange={(event) => updateField('keyAbility', event.target.value)}
                className="w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                {Object.keys(baseAbilities).map((ability) => (
                  <option key={ability} value={ability}>
                    {ability}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {currentStep === 'abilities' && (
          <div className="space-y-4" data-validation-field="abilities">
            <p className="text-sm text-slate-300">Remaining points: {remainingAbilityPoints}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {Object.entries(form.abilities).map(([ability, score]) => (
                <div key={ability} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
                    <span>{ability}</span>
                    <span>{score}</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={18}
                    value={score}
                    onChange={(event) =>
                      updateAbility(ability as keyof typeof baseAbilities, Number(event.target.value))
                    }
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'skills' && (
          <div className="space-y-4" data-validation-field="skills">
            <p className="text-sm text-slate-300">
              Choose up to {maxSkillChoices} trained skills. ({form.skills.length}/{maxSkillChoices})
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {skillList.map((skill) => {
                const selected = form.skills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`rounded border px-3 py-2 text-sm transition ${
                      selected
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-primary/40'
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {currentStep === 'feats' && (
          <div data-validation-field="feats">
            <CatalogPicker
              title="Feats"
              catalog={feats.data ?? []}
              loading={feats.loading}
              error={feats.error?.message}
              searchValue={featSearch}
              onSearchChange={setFeatSearch}
              selections={form.feats.map((feat) => feat.key)}
              onAdd={addFeat}
              onRemove={removeFeat}
              renderSelected={(key) => feats.data?.find((feat) => feat.key === key)?.name ?? key}
            />
          </div>
        )}

        {currentStep === 'spells' && (
          <div data-validation-field="spells">
            <CatalogPicker
              title="Spells"
              catalog={spells.data ?? []}
              loading={spells.loading}
              error={spells.error?.message}
              searchValue={spellSearch}
              onSearchChange={setSpellSearch}
              selections={form.spells.map((spell) => spell.key)}
              onAdd={addSpell}
              onRemove={removeSpell}
              renderSelected={(key) => spells.data?.find((spell) => spell.key === key)?.name ?? key}
            />
          </div>
        )}

        {currentStep === 'gear' && (
          <div data-validation-field="gear">
            <CatalogPicker
              title="Gear"
              catalog={items.data ?? []}
              loading={items.loading}
              error={items.error?.message}
              searchValue={gearSearch}
              onSearchChange={setGearSearch}
              selections={form.gear.map((item) => item.key)}
              onAdd={addItem}
              onRemove={removeItem}
              renderSelected={(key) => items.data?.find((item) => item.key === key)?.name ?? key}
            />
          </div>
        )}

        {currentStep === 'companions' && (
          <div className="space-y-4" data-validation-field="companions">
            <div className="flex flex-wrap gap-2">
              {companionTypes.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => addCompanion(option.type)}
                  disabled={form.companions.length >= 3}
                  className="rounded border border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:border-primary disabled:opacity-40"
                >
                  Add {option.label}
                </button>
              ))}
            </div>
            {form.companions.length === 0 ? (
              <p className="text-sm text-slate-400">No companions selected.</p>
            ) : (
              <div className="space-y-3">
                {form.companions.map((companion, index) => (
                  <div
                    key={`${companion.type}-${index}`}
                    className="space-y-2 rounded border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-100">
                      <span className="capitalize">{companion.type}</span>
                      <button
                        type="button"
                        onClick={() => removeCompanion(index)}
                        className="text-xs text-red-300 hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-xs text-slate-400">
                        Companion Name
                        <input
                          value={companion.name ?? ''}
                          onChange={(event) => updateCompanion(index, 'name', event.target.value)}
                          placeholder="Optional nickname"
                          className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-slate-400">
                        Source
                        <input
                          value={companion.source ?? ''}
                          onChange={(event) => updateCompanion(index, 'source', event.target.value)}
                          placeholder="Feat or class feature"
                          className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Status:</span>
          {status === 'legal' && <Badge className="bg-emerald-600">PFS Legal</Badge>}
          {status === 'invalid' && <Badge variant="outline">Invalid</Badge>}
          {status === 'checking' && <Badge variant="outline">Checking…</Badge>}
          {status === 'unknown' && <Badge variant="outline">Not evaluated</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={steps.findIndex((step) => step.key === currentStep) === 0}
            onClick={() => goToStep(steps.findIndex((step) => step.key === currentStep) - 1)}
            className="rounded border border-slate-800 px-4 py-2 text-sm text-slate-200 disabled:opacity-40"
          >
            Previous
          </button>
          {steps.findIndex((step) => step.key === currentStep) < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => goToStep(steps.findIndex((step) => step.key === currentStep) + 1)}
              className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/80"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/80 disabled:opacity-40"
            >
              {isPending ? 'Saving…' : 'Save Character'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  loading,
  error,
  onChange,
  field,
  placeholder,
  disabled
}: {
  label: string;
  value: string;
  options: CatalogEntry[];
  loading: boolean;
  error?: string;
  onChange: (value: string) => void;
  field?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const resolvedPlaceholder = placeholder ?? (loading ? `Loading ${label}…` : `Select ${label}`);
  return (
    <div className="space-y-3" data-validation-field={field}>
      <label className="block text-xs font-semibold uppercase text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        disabled={loading || disabled}
      >
        <option value="">{resolvedPlaceholder}</option>
        {options.map((option) => (
          <option
            key={option.key}
            value={option.key}
            title={`Source: ${option.source} | Level: ${option.level} | Tags: ${option.tags.join(', ') || '—'}`}
          >
            {option.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {value && (
        <a
          href={options.find((option) => option.key === value)?.url ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="block text-xs text-primary"
        >
          View on Archives of Nethys
        </a>
      )}
    </div>
  );
}

function CatalogPicker({
  title,
  catalog,
  selections,
  onAdd,
  onRemove,
  renderSelected,
  loading,
  error,
  searchValue,
  onSearchChange
}: {
  title: string;
  catalog: CatalogEntry[];
  selections: string[];
  onAdd: (entry: CatalogEntry) => void;
  onRemove: (key: string) => void;
  renderSelected: (key: string) => string;
  loading: boolean;
  error?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}) {
  const filterValue = searchValue ?? '';
  const filtered = useMemo(() => {
    const lower = filterValue.toLowerCase();
    return catalog.filter((entry) => entry.name.toLowerCase().includes(lower));
  }, [filterValue, catalog]);

  const remaining = filtered.filter((entry) => !selections.includes(entry.key));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
            {title} Catalog
          </label>
          <input
            value={filterValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder={`Search ${title.toLowerCase()}…`}
            className="w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded border border-slate-800 bg-slate-950 p-3 text-sm">
          {loading && <p className="text-xs text-slate-500">Loading {title.toLowerCase()}…</p>}
          {!loading && error && <p className="text-xs text-red-300">{error}</p>}
          {!loading && !error && remaining.length === 0 && (
            <p className="text-xs text-slate-500">No results.</p>
          )}
          {!loading && !error &&
            remaining.map((entry) => {
              const tooltip = `Source: ${entry.source}
Level: ${entry.level}
Tags: ${entry.tags.join(', ') || '—'}`;
              return (
                <div
                  key={entry.key}
                  className="space-y-1 rounded border border-slate-800 bg-slate-900 p-3"
                  title={tooltip}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onAdd(entry)}
                      className="flex-1 text-left font-semibold text-slate-100 hover:text-primary"
                    >
                      {entry.name}
                    </button>
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      AoN ↗
                    </a>
                  </div>
                  <div className="text-xs text-slate-400">
                    Level {entry.level} · {entry.source}
                  </div>
                  {entry.tags.length > 0 && (
                    <div className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                      {entry.tags.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
      <div className="space-y-4">
        <label className="block text-xs font-semibold uppercase text-slate-400">
          Selected {title}
        </label>
        <div className="space-y-2 rounded border border-slate-800 bg-slate-950 p-3 text-sm">
          {selections.length === 0 && <p className="text-xs text-slate-500">No selections yet.</p>}
          {selections.map((key) => {
            const entry = catalog.find((item) => item.key === key);
            const tooltip = entry
              ? `Source: ${entry.source}
Level: ${entry.level}
Tags: ${entry.tags.join(', ') || '—'}`
              : undefined;
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-4 rounded border border-slate-800 bg-slate-900 px-3 py-2"
                title={tooltip}
              >
                <div>
                  <div className="font-semibold">{renderSelected(key)}</div>
                  {entry && (
                    <a href={entry.url} className="text-xs text-primary" target="_blank" rel="noreferrer">
                      View on AoN
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(key)}
                  className="text-xs text-red-300 hover:text-red-200"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
