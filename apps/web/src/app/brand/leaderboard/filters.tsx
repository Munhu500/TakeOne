'use client';
import { useRouter } from 'next/navigation';
import { Select, SegmentedControl } from '@/components/ui/select';

interface Opt { value: string; label: string }
const ALL = 'all';
/** One compact row: period, country, category. Each change is a new address, so a filtered board can be shared. */
export function BoardFilters({ board, period, country, category, countries, categories }: { board: string; period: 'month' | 'all'; country: string; category: string; countries: Opt[]; categories: Opt[] }) {
  const router = useRouter();
  const go = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ board, period, ...(country ? { country } : {}), ...(category ? { category } : {}), ...patch });
    for (const k of ['country', 'category']) if (!q.get(k) || q.get(k) === ALL) q.delete(k);
    router.push(`/brand/leaderboard?${q}`);
  };
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <SegmentedControl label="Period" value={period} onChange={(v) => go({ period: v })} options={[{ value: 'month', label: 'This month' }, { value: 'all', label: 'All time' }]} />
      <Select id="lb-country" compact className="w-48" label="Country" value={country || ALL} onValueChange={(v) => go({ country: v })} options={[{ value: ALL, label: 'All countries' }, ...countries]} />
      <Select id="lb-category" compact className="w-48" label="Category" value={category || ALL} onValueChange={(v) => go({ category: v })} options={[{ value: ALL, label: 'All categories' }, ...categories]} />
    </div>
  );
}
