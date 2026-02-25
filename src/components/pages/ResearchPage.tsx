const SSRN_URL = 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6285320';
const PAPER_PDF = '/dice-stock-paper.pdf';
const SLIDES_PDF = '/DiceStock_Market_Dynamics.pdf';

import { useState } from 'react';

type Tab = 'overview' | 'paper';

export function ResearchPage() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="h-full flex flex-col">
      <div className="bg-[#0d1117] border-b border-gray-800 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab('overview')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'overview'
                ? 'text-white border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setTab('paper')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'paper'
                ? 'text-white border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Full Paper
          </button>
        </div>
        <a
          href={SSRN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          View on SSRN
        </a>
      </div>

      {tab === 'overview' ? (
        <iframe
          src={SLIDES_PDF}
          className="flex-1 w-full border-0"
          title="DiceStock Overview Slides"
        />
      ) : (
        <iframe
          src={PAPER_PDF}
          className="flex-1 w-full border-0"
          title="DiceStock Research Paper"
        />
      )}
    </div>
  );
}
