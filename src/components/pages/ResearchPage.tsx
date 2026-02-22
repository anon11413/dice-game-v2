const SSRN_URL = 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6285320';
const LOCAL_PDF = '/dice-stock-paper.pdf';

export function ResearchPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-[#0d1117] border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-bold text-white">Research Paper</h2>
        <div className="flex items-center gap-3">
          <a
            href={LOCAL_PDF}
            download
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Download PDF
          </a>
          <a
            href={SSRN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            View on SSRN
          </a>
        </div>
      </div>
      <iframe
        src={LOCAL_PDF}
        className="flex-1 w-full border-0"
        title="DiceStock Research Paper"
      />
    </div>
  );
}
