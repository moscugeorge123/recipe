/**
 * Lists recipes that were imported more than once from the same page.
 *
 *   npm run duplicates:list
 *
 * Before links were normalised fully (YouTube `?si=` values, `youtu.be` vs `watch?v=`, `www.`,
 * tracking parameters), one page could become several sources and so several recipes. This
 * reports each group so it can be merged by hand; it never changes data.
 */
import { disconnectPrisma, prisma } from '../infrastructure/database/prisma/client.js';
import { normalizeUrl } from '../shared/utils/url.js';

export interface SourceRow {
  id: string;
  originalUrl: string;
  recipe: { id: string; title: string; createdAt: Date } | null;
}

/** Groups sources whose links normalise to the same page, keeping groups with 2+ recipes. */
export function groupDuplicates(rows: SourceRow[]): Map<string, SourceRow[]> {
  const groups = new Map<string, SourceRow[]>();
  for (const row of rows) {
    if (!row.recipe) continue;
    let key: string;
    try {
      key = normalizeUrl(row.originalUrl);
    } catch {
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const [key, group] of groups) {
    if (group.length < 2) groups.delete(key);
  }
  return groups;
}

async function main(): Promise<void> {
  const rows = await prisma.recipeSource.findMany({
    select: {
      id: true,
      originalUrl: true,
      recipe: { select: { id: true, title: true, createdAt: true } },
    },
  });
  const groups = groupDuplicates(rows);
  if (groups.size === 0) {
    console.log('No duplicate imports found.');
    return;
  }
  for (const [page, group] of groups) {
    console.log(`\n${page}`);
    for (const row of group.sort(
      (a, b) => (a.recipe?.createdAt.getTime() ?? 0) - (b.recipe?.createdAt.getTime() ?? 0),
    )) {
      console.log(
        `  recipe ${row.recipe?.id ?? '-'}  ${row.recipe?.title ?? ''}  (source ${row.id}, ${row.originalUrl})`,
      );
    }
  }
  console.log(`\n${String(groups.size)} page(s) imported more than once.`);
}

if (process.argv[1]?.endsWith('list-duplicate-recipes.ts')) {
  main()
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => disconnectPrisma());
}
