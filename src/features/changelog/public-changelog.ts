export interface PublicChangelogEntry {
  version: string;
  developedAt: string;
  publishedAt?: string;
  title: string;
  summary: string;
  changes: string[];
}

// Only customer-approved release notes belong in this list.
export const publicChangelogEntries: PublicChangelogEntry[] = [];
