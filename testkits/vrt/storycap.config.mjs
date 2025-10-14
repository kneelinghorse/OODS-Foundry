import path from 'node:path';

const STORYCAP_TAG = 'vrt-critical';
const SNAPSHOT_ROOT = path.resolve(process.cwd(), 'artifacts', 'vrt', 'storycap');

const sanitize = (value) =>
  value
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-]/g, '')
    .toLowerCase();

export const shouldCaptureStory = (context) => {
  const tags = context?.parameters?.vrt?.tags ?? [];
  return tags.includes(STORYCAP_TAG);
};

export const getSnapshotPath = (context) => {
  const storyGroup = sanitize(context.title);
  const storyName = sanitize(context.name);
  return path.join(storyGroup, `${storyName}.png`);
};

export const storycapOptions = (context) => ({
  fileName: getSnapshotPath(context),
  outDir: SNAPSHOT_ROOT,
  flakiness: {
    retake: { enabled: true, retries: 3 },
    metrics: { enabled: true },
  },
});

export const storycapConfig = {
  STORYCAP_TAG,
  SNAPSHOT_ROOT,
  shouldCaptureStory,
  getSnapshotPath,
  storycapOptions,
};

export default storycapConfig;
