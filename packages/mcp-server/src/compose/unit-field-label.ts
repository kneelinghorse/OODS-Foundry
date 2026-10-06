/** Only these trailing snake-case tokens denote units; ordinary field labels keep their existing wording. */
export function unitFieldLabel(name: string): string | undefined {
  const match = /^(.+)_(c|f|kg|lb|km|cm|mm|px|ms)$/.exec(name);
  if (!match) return undefined;
  const unit = match[2]!;
  if ((unit === 'c' || unit === 'f') && !/(?:^|_)(?:temperature|temp)$/.test(match[1]!)) return undefined;
  const suffix = unit === 'c' ? '°C' : unit === 'f' ? '°F' : unit;
  const words = match[1]!.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} (${suffix})`;
}
