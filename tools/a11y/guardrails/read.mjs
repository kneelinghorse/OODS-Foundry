import { promises as fs } from 'node:fs';

export const PALETTE_CHECK_TYPES = Object.freeze([
  'ramp-monotonicity', 'family-hue', 'neutral-hue', 'chroma-curve', 'gamut', 'dark-coverage',
]);

export async function loadGuardrails(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (lines.length === 0) {
    return [];
  }

  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(',').map((header) => header.trim());

  return rows.map((row, index) => {
    const columns = row.split(',').map((column) => column.trim());
    if (columns.length !== headers.length) {
      throw new Error(
        `Guardrail CSV row ${index + 2} expected ${headers.length} columns but received ${columns.length}.`,
      );
    }

    const entry = {};
    headers.forEach((header, columnIndex) => {
      entry[header] = columns[columnIndex];
    });

    const numeric = (key) => {
      const raw = entry[key];
      if (!raw) {
        return null;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        throw new Error(
          `Guardrail CSV row ${index + 2} column "${key}" must be numeric. Received "${raw}".`,
        );
      }
      return value;
    };

    const text = (key) => {
      const raw = entry[key];
      return raw ? raw : null;
    };

    const checkType = entry.check_type || 'relative-color';
    if (checkType !== 'relative-color' && !PALETTE_CHECK_TYPES.includes(checkType)) {
      throw new Error(`Guardrail CSV row ${index + 2} has unknown check_type "${checkType}".`);
    }
    if (checkType === 'relative-color') {
      for (const field of ['base_token', 'derived_token']) {
        if (!entry[field]) throw new Error(`Guardrail CSV row ${index + 2} is missing "${field}".`);
      }
    }
    if (checkType !== 'relative-color' && (!entry.source || !entry.target)) {
      throw new Error(`Palette guardrail ${entry.id} requires source and target`);
    }
    return {
      checkType: checkType,
      source: text('source'),
      target: text('target'),
      id: entry.id ?? `guardrail-${index + 1}`,
      usage: entry.usage ?? 'unknown',
      theme: entry.theme ?? 'default',
      state: entry.state ?? 'state',
      baseToken: entry.base_token,
      derivedToken: entry.derived_token,
      deltaLMin: numeric('delta_l_min'),
      deltaLMax: numeric('delta_l_max'),
      deltaCMin: numeric('delta_c_min'),
      deltaCMax: numeric('delta_c_max'),
      deltaHMax: numeric('delta_h_max'),
      contrastForeground: text('contrast_foreground_token'),
      contrastBackground: text('contrast_background_token'),
      contrastThreshold: numeric('contrast_threshold'),
    };
  });
}

