interface StatusBarProps {
  contractStatus: string;
  executionMode: string;
  marketCount: number;
}

export default function StatusBar({ contractStatus, executionMode, marketCount }: StatusBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 min-h-16 bg-[#161616] border-t border-[#262626] px-3 sm:px-6 py-3 sm:py-4 z-35 flex justify-between items-center gap-4 overflow-x-auto backdrop-blur-md bg-opacity-90">
      <div className="flex items-center gap-4 sm:gap-8 md:gap-12 flex-shrink-0">
        {/* Metric 1 */}
        <div className="flex flex-col">
          <span className="font-mono text-[9px] text-[#ccc3d8]/60 uppercase tracking-widest font-extrabold mb-1">Markets</span>
          <span className="font-mono text-lg font-bold text-white leading-none">{marketCount}</span>
        </div>
        
        {/* Divider */}
        <div className="h-8 w-px bg-[#262626]" />
        
        {/* Metric 2 */}
        <div className="flex flex-col">
          <span className="font-mono text-[9px] text-[#ccc3d8]/60 uppercase tracking-widest font-extrabold mb-1">Network</span>
          <span className="font-mono text-lg font-bold text-[#10B981] leading-none">{contractStatus}</span>
        </div>
        
        {/* Divider */}
        <div className="h-8 w-px bg-[#262626]" />

        {/* Metric 3 */}
        <div className="flex flex-col">
          <span className="font-mono text-[9px] text-[#ccc3d8]/60 uppercase tracking-widest font-extrabold mb-1">Mode</span>
          <span className="font-mono text-lg font-bold text-deep-orange leading-none uppercase">{executionMode}</span>
        </div>
      </div>

      {/* Core Sync status */}
      <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#ccc3d8]/80 bg-[#0e0e0e] border border-[#262626]/60 px-3 py-1.5 rounded-full flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
        <span className="font-bold text-[10px] uppercase tracking-wider">Network Sync</span>
      </div>
    </div>
  );
}
