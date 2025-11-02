import { CharacterWizard } from '@/components/character-wizard';

export default function NewCharacterPage() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-3xl font-bold">New Character</h2>
        <p className="text-sm text-slate-300">
          Build a Pathfinder Society legal character with content sourced from the Archives of Nethys.
        </p>
      </header>
      <CharacterWizard />
    </section>
  );
}
