export type Fidelity =
  | "production"
  | "boxes-arrows"
  | "wireframe"
  | "review"
  | "branded-mockup";

type Props = {
  fidelity: Fidelity;
  framework: string;
  styling: string;
  brand: string;
  brands: string[];
  theme: string;
  onFidelityChange: (v: Fidelity) => void;
  onFrameworkChange: (v: "react" | "vue" | "html") => void;
  onStylingChange: (v: "inline" | "tokens" | "tailwind") => void;
  onBrandChange: (v: string) => void;
  onThemeChange: (v: "light" | "dark") => void;
  showBrandTheme?: boolean;
};

function Pill({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <div className="flex bg-gray-900 rounded-md border border-gray-700 overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              value === opt.value
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Brand is only meaningful for production (data-resolved-brand wrapper) and
// branded-mockup (passed as options.brandOverlay to the emitter). Other
// fidelities don't read brand state; hiding the selector removes the no-op
// control. See PS-2026-05-21-007 / s105-m02 audit axis (b).
const BRAND_AWARE_FIDELITIES: ReadonlySet<Fidelity> = new Set([
  "production",
  "branded-mockup",
]);

export function Selectors({
  fidelity,
  framework,
  styling,
  brand,
  brands,
  theme,
  onFidelityChange,
  onFrameworkChange,
  onStylingChange,
  onBrandChange,
  onThemeChange,
  showBrandTheme = true,
}: Props) {
  const isProduction = fidelity === "production";
  const showBrand = showBrandTheme && BRAND_AWARE_FIDELITIES.has(fidelity);

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <Pill
        label="Fidelity"
        value={fidelity}
        options={[
          { value: "production", label: "Production" },
          { value: "boxes-arrows", label: "Boxes" },
          { value: "wireframe", label: "Wireframe" },
          { value: "review", label: "Review" },
          { value: "branded-mockup", label: "Mockup" },
        ]}
        onChange={(v) => onFidelityChange(v as Fidelity)}
      />
      {isProduction ? (
        <>
          <Pill
            label="Framework"
            value={framework}
            options={[
              { value: "react", label: "React" },
              { value: "vue", label: "Vue" },
              { value: "html", label: "HTML" },
            ]}
            onChange={(v) => onFrameworkChange(v as "react" | "vue" | "html")}
          />
          <Pill
            label="Styling"
            value={styling}
            options={[
              { value: "tokens", label: "Tokens" },
              { value: "tailwind", label: "Tailwind" },
              { value: "inline", label: "Inline" },
            ]}
            onChange={(v) =>
              onStylingChange(v as "inline" | "tokens" | "tailwind")
            }
          />
        </>
      ) : null}
      {showBrand ? (
        <Pill
          label="Brand"
          value={brand}
          options={[
            { value: "default", label: "Default" },
            ...brands.map(value => ({ value, label: `Brand ${value}` })),
          ]}
          onChange={(v) => onBrandChange(v)}
        />
      ) : null}
      {showBrandTheme && isProduction ? (
        <Pill
          label="Theme"
          value={theme}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
          onChange={(v) => onThemeChange(v as "light" | "dark")}
        />
      ) : null}
    </div>
  );
}
