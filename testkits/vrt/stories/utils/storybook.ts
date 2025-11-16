export interface StoryIndexEntry {
  readonly id: string;
  readonly title: string;
  readonly name: string;
  readonly type?: string;
}

export interface StoryLookup {
  readonly title: string | readonly string[];
  readonly name?: string;
  readonly prefer?: 'docs' | 'story';
}

export async function loadStoryIndex(baseUrl: string): Promise<StoryIndexEntry[]> {
  const endpoints = ['/index.json', '/stories.json'];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(new URL(endpoint, baseUrl));
      if (!response.ok) {
        continue;
      }
      const payload = await response.json();
      if (payload?.entries) {
        return Object.values(payload.entries) as StoryIndexEntry[];
      }
      if (payload?.stories) {
        return Object.values(payload.stories).map((entry: any) => ({
          id: entry.id,
          title: entry.title ?? entry.kind ?? '',
          name: entry.name ?? '',
          type: typeof entry.id === 'string' && entry.id.endsWith('--docs') ? 'docs' : entry.type,
        }));
      }
    } catch (error) {
      if (process.env.DEBUG) {
        // eslint-disable-next-line no-console
        console.warn(`Failed to fetch Storybook index from ${endpoint}:`, error);
      }
    }
  }
  throw new Error(`Unable to load Storybook index from ${baseUrl}`);
}

export function resolveStoryId(entries: StoryIndexEntry[], lookup: StoryLookup): string {
  const titles = Array.isArray(lookup.title) ? lookup.title : [lookup.title];
  const candidates = entries.filter((entry) => titles.includes(entry.title));
  if (candidates.length === 0) {
    throw new Error(`Story not found for titles: ${titles.join(', ')}`);
  }

  let pick: StoryIndexEntry | undefined;
  if (lookup.name) {
    pick = candidates.find((entry) => entry.name === lookup.name);
  }
  if (!pick && lookup.prefer) {
    pick = candidates.find((entry) => entry.type === lookup.prefer);
  }
  if (!pick) {
    pick = candidates[0];
  }

  if (!pick) {
    throw new Error(`Unable to resolve story id for titles: ${titles.join(', ')}`);
  }
  return pick.id;
}
