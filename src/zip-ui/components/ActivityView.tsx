import React, { useState } from 'react';
import { ActivityItem, LeaderboardItem, UserPortfolio } from '../types';
import { Heart, Repeat, MessageSquare, AlertTriangle, Trophy, Send, Sparkles } from 'lucide-react';

interface ActivityViewProps {
  activity: ActivityItem[];
  leaderboard: LeaderboardItem[];
  portfolio: UserPortfolio;
  onPostActivity: (text: string) => void;
  onLikeActivity: (id: string) => void;
}

export default function ActivityView({
  activity,
  leaderboard,
  portfolio,
  onPostActivity,
  onLikeActivity
}: ActivityViewProps) {
  const [newPostText, setNewPostText] = useState<string>('');
  const [showFullLeaderboardModal, setShowFullLeaderboardModal] = useState<boolean>(false);

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim()) return;

    onPostActivity(newPostText);
    setNewPostText('');
  };

  const detailedLeaderboard = leaderboard.map((trader) => ({
    rank: trader.rank,
    name: trader.name,
    pnl: trader.pnl,
    winRate: '--',
    volume: '--',
    tag: 'Real records',
    letter: trader.letter || trader.name.slice(0, 1).toUpperCase()
  }));

  return (
    <main className="flex-1 ml-20 md:ml-64 bg-grid-tech overflow-y-auto relative z-10 w-full min-h-[calc(100vh-64px)]">
      <div className="max-w-[1280px] mx-auto px-4 md:px-10 py-8 md:py-12">
        
        {/* Title Header Section */}
        <header className="mb-8">
          <h1 className="text-4xl font-sans font-bold text-white mb-2">Network Activity</h1>
          <p className="text-sm text-[#ccc3d8]">Real-time stream of margin requests, system parameters, and vault interactions.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: Feed Column (cols 8) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            
            {/* Interactive Broadcast input form */}
            <form 
              onSubmit={handlePostSubmit}
              className="bg-surface-card border border-[#262626] rounded-lg p-4 flex gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden border border-[#262626] flex-shrink-0 flex items-center justify-center font-mono font-bold text-deep-orange">
                {portfolio.connected ? 'M' : 'G'}
              </div>
              <div className="flex-1 flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder={portfolio.connected ? "Broadcast a message to the Conviction network..." : "Connect wallet to broadcast on-chain thoughts..."}
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  disabled={!portfolio.connected}
                  className="bg-[#0A0A0A] border border-[#262626] text-white rounded p-2.5 flex-1 focus:outline-none focus:border-deep-orange text-xs"
                />
                <button
                  type="submit"
                  disabled={!portfolio.connected || !newPostText.trim()}
                  className="bg-deep-orange text-black font-sans font-bold text-xs px-4 py-2.5 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0"
                >
                  <Send size={12} />
                  <span>POST</span>
                </button>
              </div>
            </form>

            {/* Rendered Feed cards */}
            <div className="flex flex-col gap-4">
              {activity.map((item) => {
                const isSystem = item.type === 'system';

                return (
                  <div 
                    key={item.id}
                    className="bg-surface-card border border-[#262626] rounded-lg p-5 hover:bg-[#1A1A1A] transition-colors relative group"
                  >
                    {/* Subtle top section accent lines based on type */}
                    <div className={`absolute top-0 left-0 w-full h-[2px] opacity-50 rounded-t-lg hidden group-hover:block ${
                      isSystem ? 'bg-deep-orange' : 'bg-electric-purple'
                    }`} />

                    <div className="flex items-start gap-4">
                      {isSystem ? (
                        <div className="w-10 h-10 rounded-full bg-deep-orange/10 border border-deep-orange/30 flex items-center justify-center text-deep-orange flex-shrink-0">
                          <AlertTriangle size={18} />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-[#282828] flex-shrink-0 bg-[#2a2a2a] flex items-center justify-center font-mono font-extrabold text-[#d2bbff] text-xs">
                          {item.username.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="flex-1">
                        <div className="flex justify-between items-baseline mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-sm font-bold ${isSystem ? 'text-deep-orange' : 'text-white'}`}>
                              {isSystem ? item.name : `@${item.username}`}
                            </span>
                            <span className="font-mono text-[9px] text-[#ccc3d8]/60 uppercase tracking-widest">• {item.time}</span>
                          </div>
                        </div>

                        {/* Text description */}
                        <p className="text-xs text-[#ccc3d8] leading-relaxed mb-4 whitespace-pre-wrap">
                          {item.text}
                        </p>

                        {/* Interactive actions for regular messages */}
                        {!isSystem && (
                          <div className="flex items-center gap-6 text-[#ccc3d8] font-mono text-[10px] uppercase font-bold tracking-widest">
                            <button 
                              onClick={() => onLikeActivity(item.id)}
                              className={`flex items-center gap-1.5 transition-colors group/btn cursor-pointer ${
                                item.likedByUser ? 'text-[#EF4444]' : 'hover:text-deep-orange'
                              }`}
                            >
                              <Heart size={14} className={item.likedByUser ? 'fill-[#EF4444]' : ''} />
                              <span>{item.likes}</span>
                            </button>
                            <button 
                              onClick={() => alert('Share flow is not connected yet.')}
                              className="flex items-center gap-1.5 hover:text-[#10B981] transition-colors group/btn cursor-pointer"
                            >
                              <Repeat size={14} />
                              <span>{item.repeats}</span>
                            </button>
                            <button 
                              onClick={() => {
                                const rep = prompt('Add comment response:');
                                if (rep) alert('Reply API is not connected from this browser feed yet.');
                              }}
                              className="flex items-center gap-1.5 hover:text-white transition-colors group/btn cursor-pointer"
                            >
                              <MessageSquare size={14} />
                              <span>Reply ({item.commentsCount})</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* RIGHT: Leaderboard Widget (cols 4) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            <div className="bg-[#161616] border border-[#262626] rounded-lg overflow-hidden relative">
              <div className="w-full h-[2px] bg-deep-orange" />
              
              <div className="p-5 border-b border-[#262626] flex justify-between items-center bg-[#111111]">
                <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                  <Trophy size={16} className="text-deep-orange" />
                  <span>Leaderboard (24H PnL)</span>
                </h2>
                <Sparkles size={14} className="text-deep-orange animate-pulse" />
              </div>

              {/* Rows List */}
              <div className="flex flex-col">
                {leaderboard.slice(0, 5).map((trader) => (
                  <div 
                    key={trader.rank}
                    className="flex items-center justify-between p-4 hover:bg-[#1A1A1A] transition-colors border-b border-[#262626]/40 group text-xs font-mono"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[#ccc3d8]/60 font-extrabold w-4 text-center">{trader.rank}</span>
                      <div className="w-8 h-8 rounded-full bg-[#1c1b1b] border border-[#262626] flex items-center justify-center font-bold text-white uppercase font-mono text-[10px]">
                        {trader.letter || 'T'}
                      </div>
                      <span className="font-medium text-white group-hover:text-deep-orange transition-colors">@{trader.name}</span>
                    </div>
                    <span className="text-[#10B981] font-bold">
                      +${(trader.pnl / 1000).toFixed(1)}k
                    </span>
                  </div>
                ))}

                {/* Open detailed modal trigger */}
                <button
                  onClick={() => setShowFullLeaderboardModal(true)}
                  className="block p-4 text-center font-mono text-[10px] text-[#ccc3d8] hover:text-white hover:bg-[#1A1A1A] transition-colors uppercase tracking-widest font-extrabold cursor-pointer border-none bg-transparent"
                >
                  View Full Leaderboard
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* ==================== FULL DETAILED LEADERBOARD MODAL ==================== */}
      {showFullLeaderboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#161616] border border-[#262626] rounded-xl w-full max-w-2xl overflow-hidden relative glow-orange">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#262626] bg-[#0e0e0e] flex justify-between items-center">
              <h3 className="text-md font-sans font-bold text-white flex items-center gap-2">
                <Trophy size={18} className="text-deep-orange" />
                <span>Protocol Master Traders Leaderboard</span>
              </h3>
              <button 
                onClick={() => setShowFullLeaderboardModal(false)}
                className="text-[#ccc3d8] hover:text-white font-mono text-sm cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Table Content */}
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#262626] text-[#ccc3d8]/60 text-[10px] uppercase">
                      <th className="pb-3 text-center">Rank</th>
                      <th className="pb-3 ml-2">Trader Account</th>
                      <th className="pb-3">Win Rate</th>
                      <th className="pb-3 text-right">Volume (24h)</th>
                      <th className="pb-3 text-right">Cumulative PnL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262626]/50">
                    {detailedLeaderboard.map((trader) => (
                      <tr key={trader.rank} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-center text-[#ccc3d8] font-bold">{trader.rank}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#111] border border-[#262626] flex items-center justify-center font-bold text-white">
                              {trader.letter}
                            </div>
                            <div>
                              <div className="text-white font-semibold flex items-center gap-1.5">
                                <span>@{trader.name}</span>
                                <span className="bg-deep-orange/10 text-deep-orange font-mono text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase border border-deep-orange/10">
                                  {trader.tag}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 font-semibold text-white">{trader.winRate}</td>
                        <td className="py-3 text-right text-[#ccc3d8]">{trader.volume}</td>
                        <td className="py-3 text-right text-[#10B981] font-bold">
                          +${trader.pnl.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
