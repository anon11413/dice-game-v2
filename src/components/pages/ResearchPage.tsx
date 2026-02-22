const PAPER_URL = 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6285320';

export function ResearchPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-[#0d1117] border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-bold text-white">Research Paper</h2>
        <a
          href={PAPER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Open on SSRN
        </a>
      </div>
      <iframe
        src={PAPER_URL}
        className="flex-1 w-full border-0"
        title="DiceStock Research Paper - SSRN"
      />
    </div>
  );
}
