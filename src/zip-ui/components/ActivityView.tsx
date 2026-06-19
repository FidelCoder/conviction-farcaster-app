import React, { useEffect, useMemo, useState } from 'react';
import { ActivityItem, ActivityReplyItem, LeaderboardItem, PredictionMarket, UserPortfolio } from '../types';
import type { UserSession } from '../../lib/core-api';
import {
  AlertTriangle,
  ExternalLink,
  Heart,
  MessageSquare,
  Newspaper,
  Radio,
  Repeat,
  Search,
  Send,
  Sparkles,
  Trophy,
} from 'lucide-react';

interface ActivityViewProps {
  activity: ActivityItem[];
  leaderboard: LeaderboardItem[];
  markets: PredictionMarket[];
  onCreateSignal: (input: { marketId: string; side: 'YES' | 'NO'; thesis: string }) => Promise<{ id: string; createdAt: string } | null>;
  onOpenMarket: (market: PredictionMarket) => void;
  onRequireWallet: () => void;
  portfolio: UserPortfolio;
  session: UserSession | null;
}

type FeedTab = 'all' | 'news' | 'markets' | 'trades';
type ComposerSide = 'YES' | 'NO';

type FeedInteraction = {
  liked?: boolean;
  reposted?: boolean;
  replies?: ActivityReplyItem[];
};

type InteractionStore = Record<string, FeedInteraction>;

type SocialActionResponse =
  | { ok: true; data: { counts?: { reactions: number; bookmarks: number; replies: number } } }
  | { ok: false; error: { message: string } };

type ReplyActionResponse =
  | { ok: true; data: { reply?: { id: string; body: string; createdAt: string; author?: { username: string | null; handle: string | null; displayName: string | null } } } }
  | { ok: false; error: { message: string } };

const LOCAL_POSTS_KEY = 'conviction-activity-posts-v1';
const INTERACTIONS_KEY = 'conviction-activity-interactions-v1';

export default function ActivityView({
  activity,
  leaderboard,
  markets,
  onCreateSignal,
  onOpenMarket,
  onRequireWallet,
  portfolio,
  session,
}: ActivityViewProps) {
  const [newPostText, setNewPostText] = useState<string>('');
  const [composerSide, setComposerSide] = useState<ComposerSide>('YES');
  const [composerStatus, setComposerStatus] = useState('');
  const [replyText, setReplyText] = useState<string>('');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [feedTab, setFeedTab] = useState<FeedTab>('all');
  const [interactions, setInteractions] = useState<InteractionStore>({});
  const [localPosts, setLocalPosts] = useState<ActivityItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedMarketId, setSelectedMarketId] = useState(markets[0]?.id ?? '');
  const [showFullLeaderboardModal, setShowFullLeaderboardModal] = useState<boolean>(false);
  const [storageReady, setStorageReady] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const selectedMarket = markets.find((market) => market.id === selectedMarketId) ?? markets[0];
  const seededFeed = useMemo(() => buildSeededFeed(activity, markets), [activity, markets]);
  const feed = useMemo(
    () => dedupeActivityItems([...localPosts, ...seededFeed]).map((item) => applyInteractionState(item, interactions[item.id])),
    [interactions, localPosts, seededFeed],
  );
  const filteredFeed = useMemo(
    () => filterFeed(feed, feedTab, query),
    [feed, feedTab, query],
  );
  const detailedLeaderboard = leaderboard.map((trader) => ({
    rank: trader.rank,
    name: trader.name,
    pnl: trader.pnl,
    winRate: '--',
    volume: '--',
    tag: 'Real records',
    letter: trader.letter || trader.name.slice(0, 1).toUpperCase(),
  }));

  useEffect(() => {
    setLocalPosts(readStoredActivityItems(LOCAL_POSTS_KEY));
    setInteractions(readStoredInteractions());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    writeStoredJson(LOCAL_POSTS_KEY, localPosts.slice(0, 40));
  }, [localPosts, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    writeStoredJson(INTERACTIONS_KEY, interactions);
  }, [interactions, storageReady]);

  const handlePostSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!portfolio.connected) {
      onRequireWallet();
      return;
    }

    const body = newPostText.trim();
    if (!body || !selectedMarket) return;

    setPendingActionId('compose');
    setComposerStatus('Publishing signal...');
    const signal = await onCreateSignal({ marketId: selectedMarket.id, side: composerSide, thesis: body });
    setPendingActionId(null);

    const post: ActivityItem = {
      id: signal?.id ?? 'local-' + Date.now().toString(36),
      signalId: signal?.id,
      username: getWalletUsername(portfolio),
      name: getSessionDisplayName(session, portfolio),
      time: 'now',
      text: composerSide + ' thesis: ' + body,
      type: 'request',
      kind: signal ? 'signal' : 'post',
      likes: 0,
      commentsCount: 0,
      repeats: 0,
      likedByUser: false,
      marketId: selectedMarket.id,
      marketPrice: 'YES ' + formatChance(selectedMarket.currentOdds),
      marketTitle: selectedMarket.title,
      replies: [],
      topic: selectedMarket.discoveryTopic ?? selectedMarket.category ?? 'Market pulse',
    };

    setLocalPosts((current) => [post, ...current.filter((item) => item.id !== post.id)].slice(0, 40));
    setComposerStatus(signal ? 'Published to core.' : 'Saved locally in this browser.');
    setNewPostText('');
  };

  const toggleLike = async (item: ActivityItem) => {
    if (!portfolio.connected || !session) {
      onRequireWallet();
      return;
    }

    const nextLiked = !item.likedByUser;
    updateInteraction(item.id, { liked: nextLiked });

    if (!item.signalId) return;

    setPendingActionId('like-' + item.id);
    await postSocialAction({
      signalId: item.signalId,
      userId: session.user.id,
      action: 'reactions',
      method: nextLiked ? 'POST' : 'DELETE',
    });
    setPendingActionId(null);
  };

  const toggleRepost = async (item: ActivityItem) => {
    if (!portfolio.connected || !session) {
      onRequireWallet();
      return;
    }

    const nextReposted = !item.repostedByUser;
    updateInteraction(item.id, { reposted: nextReposted });

    if (!item.signalId) return;

    setPendingActionId('repost-' + item.id);
    await postSocialAction({
      signalId: item.signalId,
      userId: session.user.id,
      action: 'bookmarks',
      method: nextReposted ? 'POST' : 'DELETE',
    });
    setPendingActionId(null);
  };

  const submitReply = async (event: React.FormEvent, item: ActivityItem) => {
    event.preventDefault();

    if (!portfolio.connected || !session) {
      onRequireWallet();
      return;
    }

    const body = replyText.trim();
    if (!body) return;

    let reply: ActivityReplyItem = {
      id: 'reply-' + Date.now().toString(36),
      author: getWalletUsername(portfolio),
      text: body,
      time: 'now',
    };

    setPendingActionId('reply-' + item.id);

    if (item.signalId) {
      const coreReply = await postSignalReply({ signalId: item.signalId, userId: session.user.id, body });
      if (coreReply) reply = coreReply;
    }

    setInteractions((current) => {
      const existing = current[item.id] ?? {};
      return {
        ...current,
        [item.id]: {
          ...existing,
          replies: [...(existing.replies ?? []), reply].slice(-6),
        },
      };
    });
    setReplyText('');
    setActiveReplyId(null);
    setPendingActionId(null);
  };

  const updateInteraction = (id: string, patch: FeedInteraction) => {
    setInteractions((current) => {
      const existing = current[id] ?? {};
      return {
        ...current,
        [id]: {
          ...existing,
          ...patch,
        },
      };
    });
  };

  return (
    <main className="flex-1 md:ml-64 bg-grid-tech overflow-y-auto relative z-10 w-full min-h-[calc(100vh-64px)]">
      <div className="max-w-[1280px] mx-auto px-4 md:px-10 py-8 md:py-12 pb-32">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange mb-2">Prediction social</p>
            <h1 className="text-4xl font-sans font-bold text-white mb-2">Market Pulse</h1>
            <p className="max-w-2xl text-sm text-[#ccc3d8]">
              Live market news, odds shifts, wallet activity, and trader theses in one feed.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded border border-[#262626] bg-[#101010] p-2 font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8] sm:flex">
            <PulseMetric label="Posts" value={feed.length} />
            <PulseMetric label="Markets" value={markets.length} />
            <PulseMetric label="Wallet" value={portfolio.connected ? 'Live' : 'Guest'} />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <section className="rounded-lg border border-[#262626] bg-surface-card p-4 sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-deep-orange/30 bg-deep-orange/10 text-deep-orange">
                  <Radio size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Post a market take</h2>
                  <p className="text-sm text-[#ccc3d8]/80">Attach a market and publish a signal traders can reply to.</p>
                </div>
              </div>

              <form className="grid gap-3" onSubmit={handlePostSubmit}>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
                  <textarea
                    className="min-h-28 resize-y rounded border border-[#262626] bg-[#0A0A0A] p-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-[#ccc3d8]/45 focus:border-deep-orange"
                    disabled={!portfolio.connected}
                    maxLength={500}
                    onChange={(event) => setNewPostText(event.target.value)}
                    placeholder={portfolio.connected ? 'What changed, and how should the market price it?' : 'Connect wallet to post into Market Pulse'}
                    value={newPostText}
                  />
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      {(['YES', 'NO'] as ComposerSide[]).map((side) => (
                        <button
                          aria-pressed={composerSide === side}
                          className={`min-h-10 rounded border px-3 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            composerSide === side
                              ? side === 'YES'
                                ? 'border-deep-orange bg-deep-orange text-black'
                                : 'border-[#EF4444] bg-[#EF4444] text-white'
                              : 'border-[#262626] bg-[#0A0A0A] text-[#ccc3d8] hover:border-white/30'
                          }`}
                          key={side}
                          onClick={() => setComposerSide(side)}
                          type="button"
                        >
                          {side}
                        </button>
                      ))}
                    </div>
                    <label className="grid gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8]/70">
                      Market
                      <select
                        className="min-h-11 rounded border border-[#262626] bg-[#0A0A0A] p-2 text-xs text-white outline-none focus:border-deep-orange"
                        onChange={(event) => setSelectedMarketId(event.target.value)}
                        value={selectedMarket?.id ?? ''}
                      >
                        {markets.slice(0, 40).map((market) => (
                          <option key={market.id} value={market.id}>{market.title}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-deep-orange px-4 py-2 font-sans text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!portfolio.connected || !newPostText.trim() || pendingActionId === 'compose'}
                      type="submit"
                    >
                      <Send size={14} />
                      Publish
                    </button>
                  </div>
                </div>
                {composerStatus ? (
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8]/65">{composerStatus}</p>
                ) : null}
              </form>
            </section>

            <section className="rounded-lg border border-[#262626] bg-[#111111] p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  {(['all', 'news', 'markets', 'trades'] as FeedTab[]).map((tab) => (
                    <button
                      aria-pressed={feedTab === tab}
                      className={`rounded border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        feedTab === tab
                          ? 'border-deep-orange bg-deep-orange text-black'
                          : 'border-[#262626] bg-[#0A0A0A] text-[#ccc3d8] hover:border-white/30 hover:text-white'
                      }`}
                      key={tab}
                      onClick={() => setFeedTab(tab)}
                      type="button"
                    >
                      {getTabLabel(tab)}
                    </button>
                  ))}
                </div>
                <label className="relative block md:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#ccc3d8]/45" size={14} />
                  <input
                    className="w-full rounded border border-[#262626] bg-[#0A0A0A] py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-deep-orange"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search pulse..."
                    type="search"
                    value={query}
                  />
                </label>
              </div>
            </section>

            <div className="flex flex-col gap-4">
              {filteredFeed.length > 0 ? filteredFeed.map((item) => {
                const isSystem = item.type === 'system';
                const market = item.marketId ? markets.find((entry) => entry.id === item.marketId) : null;
                const replies = item.replies ?? [];

                return (
                  <article
                    className="group relative rounded-lg border border-[#262626] bg-surface-card p-5 transition-colors hover:bg-[#1A1A1A]"
                    key={item.id}
                  >
                    <div className={`absolute left-0 top-0 hidden h-[2px] w-full rounded-t-lg opacity-70 group-hover:block ${isSystem ? 'bg-deep-orange' : 'bg-electric-purple'}`} />

                    <div className="flex items-start gap-4">
                      <Avatar item={item} />
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className={`font-mono text-sm font-bold ${isSystem ? 'text-deep-orange' : 'text-white'}`}>
                              {isSystem ? item.name : '@' + item.username}
                            </span>
                            <span className="rounded border border-[#262626] bg-[#0e0e0e] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/70">
                              {item.topic ?? getKindLabel(item.kind)}
                            </span>
                            <span className="font-mono text-[9px] uppercase tracking-widest text-[#ccc3d8]/55">{item.time}</span>
                          </div>
                        </div>

                        <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-[#ccc3d8]">{item.text}</p>

                        {item.marketTitle ? (
                          <div className="mb-4 rounded border border-[#262626] bg-[#0A0A0A] p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange">Linked market</p>
                                <strong className="mt-1 block text-sm leading-snug text-white">{item.marketTitle}</strong>
                                <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8]/60">
                                  {item.marketPrice ?? (market ? formatChance(market.currentOdds) : 'Odds pending')}
                                </span>
                              </div>
                              {market ? (
                                <button
                                  className="rounded border border-deep-orange/40 bg-deep-orange/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange transition-colors hover:bg-deep-orange hover:text-black"
                                  onClick={() => onOpenMarket(market)}
                                  type="button"
                                >
                                  Open market
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        {!isSystem ? (
                          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-[#ccc3d8] font-mono text-[10px] uppercase font-bold tracking-widest">
                            <FeedAction active={item.likedByUser} busy={pendingActionId === 'like-' + item.id} count={item.likes} icon="heart" label="Like" onClick={() => void toggleLike(item)} />
                            <FeedAction active={item.repostedByUser} busy={pendingActionId === 'repost-' + item.id} count={item.repeats} icon="repeat" label="Repost" onClick={() => void toggleRepost(item)} />
                            <button
                              aria-expanded={activeReplyId === item.id}
                              className="flex items-center gap-1.5 transition-colors hover:text-white"
                              onClick={() => setActiveReplyId(activeReplyId === item.id ? null : item.id)}
                              type="button"
                            >
                              <MessageSquare size={14} />
                              <span>Reply ({item.commentsCount})</span>
                            </button>
                          </div>
                        ) : null}

                        {replies.length > 0 ? (
                          <div className="mt-4 grid gap-2 border-l border-[#262626] pl-4">
                            {replies.slice(-4).map((reply) => (
                              <div key={reply.id} className="rounded bg-[#0A0A0A] p-3 text-xs text-[#ccc3d8]">
                                <strong className="mr-2 font-mono text-white">@{reply.author}</strong>
                                <span>{reply.text}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {activeReplyId === item.id ? (
                          <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => void submitReply(event, item)}>
                            <input
                              className="min-h-10 flex-1 rounded border border-[#262626] bg-[#0A0A0A] px-3 text-xs text-white outline-none focus:border-deep-orange"
                              onChange={(event) => setReplyText(event.target.value)}
                              placeholder={portfolio.connected ? 'Reply with a source, angle, or counterpoint...' : 'Connect wallet to reply'}
                              value={replyText}
                            />
                            <button
                              className="rounded bg-deep-orange px-4 py-2 font-sans text-xs font-bold uppercase tracking-widest text-black hover:bg-white disabled:opacity-50"
                              disabled={!portfolio.connected || !replyText.trim() || pendingActionId === 'reply-' + item.id}
                              type="submit"
                            >
                              Reply
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              }) : (
                <div className="rounded-lg border border-[#262626] bg-surface-card p-6 text-sm text-[#ccc3d8]">
                  No posts match this filter yet.
                </div>
              )}
            </div>
          </div>

          <aside className="lg:col-span-4 flex flex-col gap-6">
            <section className="rounded-lg border border-[#262626] bg-[#161616] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">News lanes</p>
                  <h2 className="text-lg font-bold text-white">Markets people are watching</h2>
                </div>
                <Newspaper className="text-deep-orange" size={18} />
              </div>
              <div className="grid gap-3">
                {markets.slice(0, 5).map((market) => (
                  <button
                    className="rounded border border-[#262626] bg-[#0A0A0A] p-3 text-left transition-colors hover:border-deep-orange/50 hover:bg-deep-orange/5"
                    key={market.id}
                    onClick={() => onOpenMarket(market)}
                    type="button"
                  >
                    <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/55">
                      {market.discoveryTopic ?? market.category}
                    </span>
                    <strong className="mt-1 line-clamp-2 block text-sm leading-snug text-white">{market.title}</strong>
                    <small className="mt-2 block font-mono text-[10px] text-deep-orange">YES {formatChance(market.currentOdds)}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-[#262626] bg-surface-card p-5">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Portfolio</p>
                  <h2 className="text-lg font-bold text-white">Trade history</h2>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8]/60">
                  {portfolio.activePositions.length} records
                </span>
              </div>

              {portfolio.activePositions.length > 0 ? (
                <div className="grid gap-3">
                  {portfolio.activePositions.slice().reverse().slice(0, 4).map((position) => {
                    const explorerUrl = getExplorerTxUrl(position.chainId, position.transactionHash);

                    return (
                      <article key={position.id} className="rounded border border-[#262626] bg-[#0e0e0e] p-4">
                        <h3 className="line-clamp-2 text-sm font-bold text-white">{position.marketTitle}</h3>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8]/60">
                          {position.vaultName} - {position.timestamp}
                        </p>
                        <dl className="mt-3 grid grid-cols-2 gap-2">
                          <TradeMetric label="Collateral" value={`$${position.marginAmount.toFixed(2)}`} />
                          <TradeMetric label="Leverage" value={`${position.leverage}x`} />
                        </dl>
                        {explorerUrl && position.transactionHash ? (
                          <a
                            className="mt-3 inline-flex items-center gap-1.5 rounded border border-deep-orange/40 bg-deep-orange/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange transition-colors hover:bg-deep-orange hover:text-black"
                            href={explorerUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <span>{truncateHash(position.transactionHash)}</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded border border-[#262626] bg-[#0e0e0e] p-4 text-sm text-[#ccc3d8]">
                  Confirm a margin request to see transaction history here.
                </p>
              )}
            </section>

            <section className="bg-[#161616] border border-[#262626] rounded-lg overflow-hidden relative">
              <div className="w-full h-[2px] bg-deep-orange" />
              <div className="p-5 border-b border-[#262626] flex justify-between items-center bg-[#111111]">
                <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                  <Trophy size={16} className="text-deep-orange" />
                  <span>Leaderboard</span>
                </h2>
                <Sparkles size={14} className="text-deep-orange animate-pulse" />
              </div>

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
                    <span className="text-[#10B981] font-bold">+${(trader.pnl / 1000).toFixed(1)}k</span>
                  </div>
                ))}

                <button
                  onClick={() => setShowFullLeaderboardModal(true)}
                  className="block p-4 text-center font-mono text-[10px] text-[#ccc3d8] hover:text-white hover:bg-[#1A1A1A] transition-colors uppercase tracking-widest font-extrabold cursor-pointer border-none bg-transparent"
                  type="button"
                >
                  View Full Leaderboard
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {showFullLeaderboardModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#161616] border border-[#262626] rounded-xl w-full max-w-2xl overflow-hidden relative glow-orange">
            <div className="px-6 py-4 border-b border-[#262626] bg-[#0e0e0e] flex justify-between items-center">
              <h3 className="text-md font-sans font-bold text-white flex items-center gap-2">
                <Trophy size={18} className="text-deep-orange" />
                <span>Protocol Master Traders Leaderboard</span>
              </h3>
              <button
                onClick={() => setShowFullLeaderboardModal(false)}
                className="text-[#ccc3d8] hover:text-white font-mono text-sm cursor-pointer"
                type="button"
              >
                Close
              </button>
            </div>

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
                        <td className="py-3 text-right text-[#10B981] font-bold">+${trader.pnl.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Avatar({ item }: { item: ActivityItem }) {
  if (item.type === 'system') {
    return (
      <div className="w-10 h-10 rounded-full bg-deep-orange/10 border border-deep-orange/30 flex items-center justify-center text-deep-orange flex-shrink-0">
        <AlertTriangle size={18} />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-full overflow-hidden border border-[#282828] flex-shrink-0 bg-[#2a2a2a] flex items-center justify-center font-mono font-extrabold text-[#d2bbff] text-xs">
      {item.username.slice(0, 2).toUpperCase()}
    </div>
  );
}

function FeedAction({
  active,
  busy,
  count,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  busy?: boolean;
  count: number;
  icon: 'heart' | 'repeat';
  label: string;
  onClick: () => void;
}) {
  const Icon = icon === 'heart' ? Heart : Repeat;

  return (
    <button
      className={`flex items-center gap-1.5 transition-colors disabled:cursor-wait disabled:opacity-60 ${active ? 'text-deep-orange' : 'hover:text-deep-orange'}`}
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      <Icon size={14} className={active && icon === 'heart' ? 'fill-current' : ''} />
      <span>{label} ({count})</span>
    </button>
  );
}

function PulseMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-[#262626] bg-[#0A0A0A] px-3 py-2">
      <span className="block text-[#ccc3d8]/55">{label}</span>
      <strong className="mt-1 block text-white">{value}</strong>
    </div>
  );
}

function TradeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#262626] bg-[#050505] p-3">
      <dt className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/50">{label}</dt>
      <dd className="mt-1 font-mono text-xs font-bold text-white">{value}</dd>
    </div>
  );
}

function buildSeededFeed(activity: ActivityItem[], markets: PredictionMarket[]) {
  const socialItems: ActivityItem[] = activity.map((item) => ({
    ...item,
    kind: item.kind ?? 'signal',
    replies: item.replies ?? [],
    topic: item.topic ?? 'Signal',
  }));
  const marketNews = markets.slice(0, 8).map((market, index): ActivityItem => ({
    id: 'market-pulse-' + market.id,
    username: 'marketdesk',
    name: 'Market Desk',
    time: index < 2 ? 'live' : market.syncedAt ? 'updated' : 'watching',
    text: buildMarketPulseText(market),
    type: 'request',
    kind: 'news',
    likes: Math.max(2, Math.round(market.currentOdds / 12)),
    commentsCount: index % 3,
    repeats: Math.max(1, Math.round((100 - market.currentOdds) / 18)),
    marketId: market.id,
    marketPrice: 'YES ' + formatChance(market.currentOdds),
    marketTitle: market.title,
    replies: [],
    topic: market.discoveryTopic ?? market.category ?? 'Market pulse',
  }));

  return [...socialItems, ...marketNews];
}

function buildMarketPulseText(market: PredictionMarket) {
  const description = market.description.replace(/\s+/g, ' ').trim();
  const summary = description.length > 180 ? description.slice(0, 177).trimEnd() + '...' : description;

  return `${market.discoveryTopic ?? market.category} market moving at ${formatChance(market.currentOdds)} YES.\n${summary}`;
}

function dedupeActivityItems(items: ActivityItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function applyInteractionState(item: ActivityItem, interaction: FeedInteraction | undefined): ActivityItem {
  const localReplies = interaction?.replies ?? [];
  const baseReplies = item.replies ?? [];
  const baseLiked = item.likedByUser ?? false;
  const baseReposted = item.repostedByUser ?? false;
  const liked = interaction?.liked ?? baseLiked;
  const reposted = interaction?.reposted ?? baseReposted;
  const likeDelta = liked === baseLiked ? 0 : liked ? 1 : -1;
  const repostDelta = reposted === baseReposted ? 0 : reposted ? 1 : -1;

  return {
    ...item,
    commentsCount: item.commentsCount + localReplies.length,
    likedByUser: liked,
    likes: Math.max(0, item.likes + likeDelta),
    replies: [...baseReplies, ...localReplies],
    repeats: Math.max(0, item.repeats + repostDelta),
    repostedByUser: reposted,
  };
}

function filterFeed(feed: ActivityItem[], tab: FeedTab, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  return feed.filter((item) => {
    if (tab === 'news' && item.kind !== 'news') return false;
    if (tab === 'markets' && !item.marketId) return false;
    if (tab === 'trades' && item.kind !== 'trade' && item.kind !== 'signal') return false;

    if (!normalizedQuery) return true;

    return [item.text, item.marketTitle, item.username, item.topic]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

function getTabLabel(tab: FeedTab) {
  if (tab === 'news') return 'News';
  if (tab === 'markets') return 'Markets';
  if (tab === 'trades') return 'Trades';
  return 'For you';
}

function getKindLabel(kind: ActivityItem['kind']) {
  if (kind === 'news') return 'News';
  if (kind === 'trade') return 'Trade';
  if (kind === 'post') return 'Post';
  if (kind === 'signal') return 'Signal';
  return 'Pulse';
}

function readStoredActivityItems(key: string): ActivityItem[] {
  const parsed = readStoredJson<ActivityItem[]>(key, []);

  return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string') : [];
}

function readStoredInteractions(): InteractionStore {
  const parsed = readStoredJson<InteractionStore>(INTERACTIONS_KEY, {});

  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function readStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures; the feed remains interactive for this session.
  }
}

const EXPLORER_TX_BASE_BY_CHAIN: Record<number, string> = {
  1: 'https://etherscan.io/tx/',
  10: 'https://optimistic.etherscan.io/tx/',
  11155111: 'https://sepolia.etherscan.io/tx/',
  42161: 'https://arbiscan.io/tx/',
  421614: 'https://sepolia.arbiscan.io/tx/',
  8453: 'https://basescan.org/tx/',
  84532: 'https://sepolia.basescan.org/tx/',
};

function getExplorerTxUrl(chainId: number | undefined, hash: string | undefined) {
  if (!chainId || !hash) return null;
  const baseUrl = EXPLORER_TX_BASE_BY_CHAIN[chainId];

  return baseUrl ? baseUrl + hash : null;
}

function truncateHash(value: string) {
  return value.length > 14 ? value.slice(0, 6) + '...' + value.slice(-4) : value;
}

function compactHash(value: string) {
  return value.length > 12 ? value.slice(0, 6) + '...' + value.slice(-4) : value;
}

function getWalletUsername(portfolio: UserPortfolio) {
  return portfolio.address ? 'wallet' + portfolio.address.slice(-6).toLowerCase() : 'guest';
}

function getSessionDisplayName(session: UserSession | null, portfolio: UserPortfolio) {
  return session?.traderProfile?.handle ?? session?.socialAccount?.username ?? (portfolio.address ? 'Wallet ' + compactHash(portfolio.address) : 'Conviction trader');
}

async function postSocialAction({
  action,
  method,
  signalId,
  userId,
}: {
  action: 'reactions' | 'bookmarks';
  method: 'POST' | 'DELETE';
  signalId: string;
  userId: string;
}) {
  try {
    const response = await fetch('/api/social/signals/' + encodeURIComponent(signalId) + '/' + action, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const body = (await response.json()) as SocialActionResponse;

    return response.ok && body.ok;
  } catch {
    return false;
  }
}

async function postSignalReply({ signalId, userId, body }: { signalId: string; userId: string; body: string }) {
  try {
    const response = await fetch('/api/social/signals/' + encodeURIComponent(signalId) + '/replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorUserId: userId, body }),
    });
    const parsed = (await response.json()) as ReplyActionResponse;

    if (!response.ok || !parsed.ok || !parsed.data.reply) return null;

    const reply = parsed.data.reply;

    return {
      id: reply.id,
      author: reply.author?.username ?? reply.author?.handle ?? reply.author?.displayName ?? 'trader',
      text: reply.body,
      time: formatReplyTime(reply.createdAt),
    };
  } catch {
    return null;
  }
}

function formatReplyTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'now';

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return minutes + 'm ago';

  const hours = Math.floor(minutes / 60);
  return hours < 24 ? hours + 'h ago' : Math.floor(hours / 24) + 'd ago';
}

function formatChance(value: number) {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(1) + '%';
}
