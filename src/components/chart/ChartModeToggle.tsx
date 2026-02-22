interface Props {
  mode: 'candle' | 'line';
  onChange: (mode: 'candle' | 'line') => void;
}

export function ChartModeToggle({ mode, onChange }: Props) {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => onChange('candle')}
        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
          mode === 'candle'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-400 hover:text-gray-200'
        }`}
      >
        Candle
      </button>
      <button
        onClick={() => onChange('line')}
        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
          mode === 'line'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-400 hover:text-gray-200'
        }`}
      >
        Line
      </button>
    </div>
  );
}
