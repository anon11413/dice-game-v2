import { RESOLUTIONS } from '../../engine/constants';

interface Props {
  selected: number;
  onChange: (resolution: number) => void;
}

const options = [
  { label: '1T', value: RESOLUTIONS.TICK },
  { label: '13T', value: RESOLUTIONS.HOURLY },
  { label: '65T', value: RESOLUTIONS.DAILY },
  { label: '325T', value: RESOLUTIONS.WEEKLY },
];

export function ResolutionSelector({ selected, onChange }: Props) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
            selected === opt.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
