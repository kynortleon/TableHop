import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-4">
      <p>
        Welcome to TableHop. Jump right into your{' '}
        <Link href="/characters" className="font-semibold text-primary">
          Character Vault
        </Link>
        .
      </p>
    </div>
  );
}
