'use client';

import { useMemo, useState, useTransition } from 'react';
import { characterSchema } from '@/lib/validators/character';
import type { CatalogEntry } from '@/lib/aon/types';
import { Badge } from './ui/badge';

interface WizardProps {
  catalogs: Record<string, CatalogEntry[]>;
}

type StepKey = 'identity' | 'abilities' | 'skills' | 'feats' | 'spells' | 'gear';

const steps: Array<{ key: StepKey; label: string }> = [
  { key: 'identity', label: 'Identity' },
  { key: 'abilities', label: 'Abilities' },
  { key: 'skills', label: 'Skills' },
  { key: 'feats', label: 'Feats' },
  { key: 'spells', label: 'Spells' },
  { key: 'gear', label: 'Gear' }
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

export function CharacterWizard({ catalogs }: WizardProps) {
  const [currentStep, setCurrentStep] = useState<StepKey>('identity');
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: '',
    level: 1,
    ancestry: '',
    background: '',
    clazz: '',
    subclass: '',
    keyAbility: 'STR',
    abilities: { ...baseAbilities },
    skills: [] as string[],
    feats: [] as Array<{ key: string; level: number }>,
    spells: [] as Array<{ key: string; level: number }>,
    gear: [] as Array<{ key: string; quantity: number; totalCost: number }>
  });
  const [legalityStatus, setLegalityStatus] = useState<'unknown' | 'checking' | 'legal' | 'invalid'>(
    'unknown'
  );
  const [legalityReasons, setLegalityReasons] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const totalAbilityScore = useMemo(
    () => Object.values(form.abilities).reduce((acc, score) => acc + score, 0),
    [form.abilities]
  );

  const remainingAbilityPoints = abilityBudget - totalAbilityScore;

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateAbility = (ability: keyof typeof baseAbilities, value: number) => {
    setForm((prev) => {
      const nextAbilities = {
        ...prev.abilities,
        [ability]: value
      };
      const nextTotal = Object.values(nextAbilities).reduce((acc, score) => acc + score, 0);
      if (nextTotal > abilityBudget) {
        return prev;
      }
      return {
        ...prev,
        abilities: nextAbilities
      };
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

  const submit = async () => {
    setError(null);
    setLegalityStatus('checking');
    setLegalityReasons([]);

    const parsed = characterSchema.safeParse(form);
    if (!parsed.success) {
      setLegalityStatus('invalid');
      setError('Validation failed. Please check each step for missing information.');
      return;
    }

    startTransition(async () => {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data)
      });

      if (!res.ok) {
        const body = await res.json();
        setLegalityStatus('invalid');
        setError(body.error ? JSON.stringify(body.error) : 'Failed to save character.');
        return;
      }

      const body = await res.json();
      setLegalityStatus(body.legality.legal ? 'legal' : 'invalid');
      setLegalityReasons(body.legality.reasons);
      if (body.character?.id) {
        window.location.href = `/characters/${body.character.id}`;
      }
    });
  };

  const stepIndex = steps.findIndex((step) => step.key === currentStep);
  const goToStep = (index: number) => {
    setCurrentStep(steps[Math.max(0, Math.min(steps.length - 1, index))].key);
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-6">
        {steps.map((step, index) => (
          <button
            key={step.key}
            type="button"
            onClick={() => setCurrentStep(step.key)}
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

      <div className="rounded border border-slate-800 bg-slate-950 p-6">
        {currentStep === 'identity' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase text-slate-400">Name</label>
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-3">
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
              value={form.ancestry}
              options={catalogs.ancestries}
              onChange={(value) => updateField('ancestry', value)}
            />
            <SelectField
              label="Background"
              value={form.background}
              options={catalogs.backgrounds}
              onChange={(value) => updateField('background', value)}
            />
            <SelectField
              label="Class"
              value={form.clazz}
              options={catalogs.classes}
              onChange={(value) => updateField('clazz', value)}
            />
            <div className="space-y-3">
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
          <div className="space-y-4">
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
                    onChange={(event) => updateAbility(ability as keyof typeof baseAbilities, Number(event.target.value))}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'skills' && (
          <div className="space-y-4">
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
          <CatalogPicker
            title="Feats"
            catalog={catalogs.feats}
            selections={form.feats.map((feat) => feat.key)}
            onAdd={addFeat}
            onRemove={removeFeat}
            renderSelected={(key) => catalogs.feats.find((feat) => feat.key === key)?.name ?? key}
          />
        )}

        {currentStep === 'spells' && (
          <CatalogPicker
            title="Spells"
            catalog={catalogs.spells}
            selections={form.spells.map((spell) => spell.key)}
            onAdd={addSpell}
            onRemove={removeSpell}
            renderSelected={(key) => catalogs.spells.find((spell) => spell.key === key)?.name ?? key}
          />
        )}

        {currentStep === 'gear' && (
          <CatalogPicker
            title="Gear"
            catalog={catalogs.items}
            selections={form.gear.map((item) => item.key)}
            onAdd={addItem}
            onRemove={removeItem}
            renderSelected={(key) => catalogs.items.find((item) => item.key === key)?.name ?? key}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Status:</span>
          {legalityStatus === 'legal' && <Badge>PFS Legal</Badge>}
          {legalityStatus === 'invalid' && <Badge variant="outline">Invalid</Badge>}
          {legalityStatus === 'checking' && <Badge variant="outline">Checking…</Badge>}
          {legalityStatus === 'unknown' && <Badge variant="outline">Not evaluated</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => goToStep(stepIndex - 1)}
            className="rounded border border-slate-800 px-4 py-2 text-sm text-slate-200 disabled:opacity-40"
          >
            Previous
          </button>
          {stepIndex < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => goToStep(stepIndex + 1)}
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
      {legalityReasons.length > 0 && (
        <div className="space-y-2 text-xs text-red-300">
          <p>Legality issues detected:</p>
          <ul className="list-inside list-disc space-y-1">
            {legalityReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: CatalogEntry[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold uppercase text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-primary focus:outline-none"
      >
        <option value="">Select {label}</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.name}
          </option>
        ))}
      </select>
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
  renderSelected
}: {
  title: string;
  catalog: CatalogEntry[];
  selections: string[];
  onAdd: (entry: CatalogEntry) => void;
  onRemove: (key: string) => void;
  renderSelected: (key: string) => string;
}) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const lower = filter.toLowerCase();
    return catalog.filter((entry) => entry.name.toLowerCase().includes(lower));
  }, [filter, catalog]);

  const remaining = filtered.filter((entry) => !selections.includes(entry.key));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
            {title} Catalog
          </label>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={`Search ${title.toLowerCase()}…`}
            className="w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded border border-slate-800 bg-slate-950 p-3 text-sm">
          {remaining.length === 0 && <p className="text-xs text-slate-500">No results.</p>}
          {remaining.map((entry) => (
            <button
              type="button"
              key={entry.key}
              onClick={() => onAdd(entry)}
              className="flex w-full flex-col rounded border border-slate-800 bg-slate-900 px-3 py-2 text-left hover:border-primary/40"
            >
              <span className="font-semibold">{entry.name}</span>
              <span className="text-xs text-slate-400">
                Level {entry.level} · {entry.source}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <label className="block text-xs font-semibold uppercase text-slate-400">
          Selected {title}
        </label>
        <div className="space-y-2 rounded border border-slate-800 bg-slate-950 p-3 text-sm">
          {selections.length === 0 && <p className="text-xs text-slate-500">No selections yet.</p>}
          {selections.map((key) => (
            <div key={key} className="flex items-center justify-between gap-4 rounded border border-slate-800 bg-slate-900 px-3 py-2">
              <div>
                <div className="font-semibold">{renderSelected(key)}</div>
                <a href={catalog.find((entry) => entry.key === key)?.url ?? '#'} className="text-xs text-primary" target="_blank" rel="noreferrer">
                  View on AoN
                </a>
              </div>
              <button
                type="button"
                onClick={() => onRemove(key)}
                className="text-xs text-red-300 hover:text-red-200"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
