export default function Flash({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  if (searchParams.err)
    return <div role="alert" className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{searchParams.err}</div>;
  if (searchParams.ok)
    return <div role="status" className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{searchParams.ok}</div>;
  return null;
}
