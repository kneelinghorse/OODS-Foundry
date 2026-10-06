export const FIXTURE_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "user", label: "User" },
  { id: "product", label: "Product" },
  { id: "subscription", label: "Subscription" },
  { id: "article", label: "Article" },
  { id: "author", label: "Author" },
  { id: "comment", label: "Comment" },
  { id: "content-pack", label: "Content pack (3 entities)" },
  { id: "billing-multi-entity", label: "Billing (multi-entity)" },
  { id: "subscription-low-confidence", label: "Subscription (low-conf)" },
];

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function FixturePicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-indigo-200/70 mr-2">
        Fixture
      </span>
      {FIXTURE_OPTIONS.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            data-testid={`fixture-${opt.id}`}
            onClick={() => onChange(opt.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-indigo-400 bg-indigo-500 text-white"
                : "border-white/10 bg-slate-900/60 text-indigo-50/70 hover:border-indigo-300/40 hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
