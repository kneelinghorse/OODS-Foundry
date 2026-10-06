/** The existing Vega formatting dependency does not publish TypeScript declarations. */
declare module 'vega-format' {
  interface NumberLocale {
    formatFloat(specifier: string): (value: number) => string;
  }
  export function numberFormatLocale(definition: { decimal: string; thousands: string; grouping: number[]; currency: [string, string] }): NumberLocale;
  export function numberFormatDefaultLocale(): NumberLocale;
  export function timeFormatDefaultLocale(): { utcFormat(specifier: string): (value: Date) => string };
}
