const STARTERS = [
  { label: 'Dashboard', intent: 'subscription dashboard with KPIs and activity feed' },
  { label: 'Detail', intent: 'subscription detail page showing plan and billing info' },
  { label: 'Form', intent: 'user registration form with name email and role' },
  { label: 'List', intent: 'product catalog list with search and filters' },
  { label: 'Timeline', intent: 'subscription billing history timeline' },
  { label: 'Viz', intent: 'revenue chart by month with status breakdown' },
  { label: 'Card', intent: 'plan pricing card with features and CTA' },
  { label: 'Settings', intent: 'account settings form with password and preferences' },
] as const;

type Props = {
  onSelect: (intent: string) => void;
};

export function StarterPrompts({ onSelect }: Props) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-gray-600 mr-1">Try:</span>
      {STARTERS.map(({ label, intent }) => (
        <button
          key={label}
          onClick={() => onSelect(intent)}
          className="text-xs px-2 py-0.5 rounded-full border border-gray-700 text-gray-400 hover:text-indigo-300 hover:border-indigo-500/50 transition-colors"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
