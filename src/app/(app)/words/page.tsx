import { WordsView } from "./words-view";

const FILTERS = ["categories", "learning", "known"] as const;
type Filter = (typeof FILTERS)[number];

export default async function WordsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const initialFilter = FILTERS.includes(filter as Filter) ? (filter as Filter) : "categories";
  return <WordsView initialFilter={initialFilter} />;
}
