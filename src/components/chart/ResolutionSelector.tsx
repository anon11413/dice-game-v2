import { RESOLUTIONS } from '../../engine/constants';

interface Props {
  selected: number;
  onChange: (resolution: number) => void;
}

const options = [
  { label: '1s', value: RESOLUTIONS.ONE_SEC },
  { label: '1m', value: RESOLUTIONS.ONE_MIN },
  { label: '2m', value: RESOLUTIONS.TWO_MIN },
  { label: '5m', value: RESOLUTIONS.FIVE_MIN },
  { label: '10m', value: RESOLUTIONS.TEN_MIN },
  { label: '20m', value: RESOLUTIONS.TWENTY_MIN },
  { label: '1h', value: RESOLUTIONS.ONE_HOUR },
  { label: '2h', value: RESOLUTIONS.TWO_HOUR },
  { label: '1D', value: RESOLUTIONS.ONE_DAY },
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
