import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SSRN_URL = 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6285320';
const PAPER_MD = '/dice-stock-paper-v2.md';
const SLIDES_PDF = '/DiceStock_Market_Dynamics.pdf';

type Tab = 'overview' | 'paper';

export function ResearchPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(PAPER_MD)
      .then((res) => res.text())
      .then((text) => {
        // Strip YAML front matter if present
        let stripped = text.replace(/^---[\s\S]*?---\s*/, '');
        // Fix image paths: ../paper-assets/ → /paper-assets/
        stripped = stripped.replace(/\.\.\//g, '/');
        setMarkdown(stripped);
        setLoading(false);
      })
      .catch(() => {
        setMarkdown('Failed to load paper.');
        setLoading(false);
      });
  }, []);

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
        <div className="flex-1 overflow-y-auto bg-[#0d1117]">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Loading paper...
            </div>
          ) : (
            <article className="paper-content max-w-4xl mx-auto px-6 py-8">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </article>
          )}
        </div>
      )}
    </div>
  );
}
