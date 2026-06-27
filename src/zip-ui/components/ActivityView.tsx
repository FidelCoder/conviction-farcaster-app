import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityItem, LeaderboardItem, PredictionMarket, UserPortfolio } from '../types';
import type { DiscoveredUser, SocialActor, UserSession } from '../../lib/core-api';
import { isClaimedVictionHandle, isClaimedVictionProfile } from '../../lib/viction-profile';
import {
  AlertTriangle,
  ExternalLink,
  Heart,
  Instagram,
  MessageSquare,
  Newspaper,
  PlayCircle,
  Radio,
  Repeat,
  SendIcon,
  X,
  UserPlus,
  Users,
  Search,
  Send,
  Share2,
  Sparkles,
  Trophy,
} from 'lucide-react';

interface ActivityViewProps {
  activity: ActivityItem[];
  leaderboard: LeaderboardItem[];
  markets: PredictionMarket[];
  onCreateSignal: (input: { marketId: string; side: 'YES' | 'NO'; thesis: string }) => Promise<{ id: string; createdAt: string } | null>;
  onCreatePost: (input: { body: string; mediaUrl?: string | null; mediaType?: string | null }) => Promise<{ id: string; createdAt: string } | null>;
  onOpenMarket: (market: PredictionMarket) => void;
  onRequireWallet: () => void;
  onTimelineRefresh?: () => void;
  portfolio: UserPortfolio;
  session: UserSession | null;
}

type FeedTab = 'for-you' | 'following' | 'live' | 'highlights' | 'markets' | 'trades' | 'people';
type ComposerSide = 'YES' | 'NO';

type SignalParticipants = {
  reactions: SocialActor[];
  bookmarks: SocialActor[];
  commenters: SocialActor[];
};

type ParticipantsStore = Record<string, SignalParticipants>;

type SocialActionResponse =
  | { ok: true; data: { counts?: { reactions: number; bookmarks: number; replies: number } } }
  | { ok: false; error: { message: string } };

type ReplyActionResponse =
  | { ok: true; data: { reply?: { id: string; body: string; createdAt: string; author?: { username: string | null; handle: string | null; displayName: string | null } } } }
  | { ok: false; error: { message: string } };

type ParticipantsResponse =
  | { ok: true; data: { participants?: SignalParticipants } }
  | { ok: false; error: { message: string } };

type UsersDiscoveryResponse =
  | { ok: true; data: { users?: DiscoveredUser[] } }
  | { ok: false; error: { message: string } };

type ActivityMediaItem = {
  id: string;
  marketId: string | null;
  kind: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  videoUrl: string | null;
  createdAt: string;
};

type UserPreference = {
  topics: string[];
  regions: string[];
  sports: string[];
  mediaTypes: string[];
  newsIntervalMinutes: number;
  notifyInActivity: boolean;
};

type PreferenceResponse =
  | { ok: true; data: { preference: UserPreference } }
  | { ok: false; error: { message: string } };

type ActivityMediaResponse =
  | { ok: true; data: { items?: ActivityMediaItem[] } }
  | { ok: false; error: { message: string } };

export default function ActivityView({
  activity,
  leaderboard,
  markets,
  onCreateSignal,
  onCreatePost,
  onOpenMarket,
  onRequireWallet,
  onTimelineRefresh,
  portfolio,
  session,
}: ActivityViewProps) {
  const [newPostText, setNewPostText] = useState<string>('');
  const [composerSide, setComposerSide] = useState<ComposerSide>('YES');
  const [composerStatus, setComposerStatus] = useState('');
  const [publishedSignalId, setPublishedSignalId] = useState<string | null>(null);
  const [shareTargetMarket, setShareTargetMarket] = useState<PredictionMarket | null>(null);
  const [roomMarket, setRoomMarket] = useState<PredictionMarket | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [feedTab, setFeedTab] = useState<FeedTab>('for-you');
  const [participants, setParticipants] = useState<ParticipantsStore>({});
  const [query, setQuery] = useState('');
  const [selectedMarketId, setSelectedMarketId] = useState('');
  const [showFullLeaderboardModal, setShowFullLeaderboardModal] = useState<boolean>(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [networkUsers, setNetworkUsers] = useState<DiscoveredUser[]>([]);
  const [networkStatus, setNetworkStatus] = useState('');
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<ActivityMediaItem[]>([]);
  const [mediaStatus, setMediaStatus] = useState('');
  const [preference, setPreference] = useState<UserPreference | null>(null);
  const [preferenceDraft, setPreferenceDraft] = useState('Sports, World Cup, Crypto, Geopolitics');

  const realMarkets = markets.filter((market) => market.id !== 'empty-market-state');
  const selectedMarket = selectedMarketId ? realMarkets.find((market) => market.id === selectedMarketId) ?? null : null;
  const communityHandle = isClaimedVictionProfile(session?.traderProfile) ? session?.traderProfile?.handle ?? '' : '';
  const hasCommunityIdentity = Boolean(portfolio.connected && session && communityHandle);
  const feed = useMemo(() => normalizeActivityFeed(activity), [activity]);
  const filteredFeed = useMemo(
    () => filterFeed(feed, feedTab, query, followingIds),
    [feed, feedTab, followingIds, query],
  );
  const roomFeed = useMemo(
    () => roomMarket ? feed.filter((item) => item.marketId === roomMarket.id).slice(0, 12) : [],
    [feed, roomMarket],
  );
  const visibleSignalIds = useMemo(
    () => filteredFeed
      .map((item) => item.signalId)
      .filter((signalId): signalId is string => Boolean(signalId))
      .slice(0, 16),
    [filteredFeed],
  );
  const detailedLeaderboard = leaderboard.map((trader) => ({
    rank: trader.rank,
    name: trader.name,
    pnl: trader.pnl,
    winRate: '--',
    volume: '--',
    tag: 'Core profile',
    letter: trader.letter || trader.name.slice(0, 1).toUpperCase(),
  }));

  useEffect(() => {
    if (!session?.user.id) {
      setFollowingIds(new Set());
      return;
    }

    let cancelled = false;

    fetch('/api/social/users/' + encodeURIComponent(session.user.id) + '/following?limit=100')
      .then((response) => response.json())
      .then((body: unknown) => {
        if (cancelled) return;
        setFollowingIds(new Set(parseFollowingIds(body)));
      })
      .catch(() => {
        if (!cancelled) setFollowingIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: '40' });
    if (session?.user.id) params.set('viewerUserId', session.user.id);
    if (query.trim() && feedTab === 'people') params.set('query', query.trim());

    setNetworkStatus('Loading network...');
    fetch('/api/social/users?' + params.toString())
      .then((response) => response.json())
      .then((body: UsersDiscoveryResponse) => {
        if (cancelled) return;
        const users = body.ok ? body.data.users ?? [] : [];
        setNetworkUsers(users);
        setNetworkStatus(users.length > 0 ? '' : 'No real users matched yet. Invite people to grow the network.');
        setFollowingIds((current) => {
          const next = new Set(current);
          users.forEach((user) => {
            if (user.viewer?.following) next.add(user.user.id);
          });
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setNetworkUsers([]);
          setNetworkStatus('User network is unavailable right now.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [feedTab, query, session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) {
      setPreference(null);
      setMediaItems([]);
      return;
    }

    let cancelled = false;

    fetch('/api/preferences/' + encodeURIComponent(session.user.id))
      .then((response) => response.json())
      .then((body: PreferenceResponse) => {
        if (cancelled || !body.ok) return;
        setPreference(body.data.preference);
        setPreferenceDraft(body.data.preference.topics.join(', '));
      })
      .catch(() => {
        if (!cancelled) setPreference(null);
      });

    refreshMediaFeed(session.user.id, setMediaItems, setMediaStatus);

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);


  useEffect(() => {
    const missingSignalIds = visibleSignalIds.filter((signalId) => !participants[signalId]);
    if (missingSignalIds.length === 0) return;

    let cancelled = false;

    void Promise.all(
      missingSignalIds.map(async (signalId) => {
        const nextParticipants = await fetchSignalParticipants(signalId);
        return [signalId, nextParticipants] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;

      setParticipants((current) => {
        const next = { ...current };
        entries.forEach(([signalId, nextParticipants]) => {
          next[signalId] = nextParticipants;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [participants, visibleSignalIds]);

  const handlePostSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!portfolio.connected) {
      onRequireWallet();
      return;
    }

    if (!requireCommunityIdentity()) {
      return;
    }

    const body = newPostText.trim();
    if (!body) return;

    setPendingActionId('compose');
    setPublishedSignalId(null);

    if (!selectedMarket) {
      setComposerStatus('Publishing Pulse post...');
      const post = await onCreatePost({ body });
      setPendingActionId(null);

      if (!post) {
        setComposerStatus('Core did not record the Pulse post. Nothing was posted.');
        return;
      }

      setComposerStatus('Published to Pulse.');
      setNewPostText('');
      onTimelineRefresh?.();
      return;
    }

    setComposerStatus('Publishing signal...');
    const signal = await onCreateSignal({ marketId: selectedMarket.id, side: composerSide, thesis: body });
    setPendingActionId(null);

    if (!signal) {
      setComposerStatus('Core did not record the signal. Nothing was posted.');
      return;
    }

    const post: ActivityItem = {
      id: signal.id,
      signalId: signal.id,
      username: getSessionUsername(session, portfolio),
      name: getSessionDisplayName(session, portfolio),
      time: 'now',
      text: body,
      type: 'request',
      kind: 'signal',
      likes: 0,
      commentsCount: 0,
      repeats: 0,
      likedByUser: false,
      marketId: selectedMarket.id,
      marketPrice: 'YES ' + formatChance(selectedMarket.currentOdds),
      marketTitle: selectedMarket.title,
      signalSide: composerSide,
      convictionLevel: 70,
      replies: [],
      topic: selectedMarket.discoveryTopic ?? selectedMarket.category ?? 'Market pulse',
    };

    void post;
    setPublishedSignalId(signal.id);
    setComposerStatus('Published. Share the card while the market is hot.');
    setNewPostText('');
    onTimelineRefresh?.();
  };

  const toggleLike = async (item: ActivityItem) => {
    if (!requireCommunityIdentity()) {
      return;
    }

    const activeSession = session;
    if (!activeSession) return;

    const nextLiked = !item.likedByUser;

    if (!item.signalId && !item.postId) return;

    setPendingActionId('like-' + item.id);
    const accepted = await postSocialAction({
      targetType: item.postId ? 'posts' : 'signals',
      targetId: item.postId ?? item.signalId ?? '',
      userId: activeSession.user.id,
      action: 'reactions',
      method: nextLiked ? 'POST' : 'DELETE',
    });
    if (accepted) {
      if (item.signalId) await refreshSignalParticipants(item.signalId);
      onTimelineRefresh?.();
    }
    setPendingActionId(null);
  };

  const toggleRepost = async (item: ActivityItem) => {
    if (!requireCommunityIdentity()) {
      return;
    }

    const activeSession = session;
    if (!activeSession) return;

    const nextReposted = !item.repostedByUser;

    if (!item.signalId && !item.postId) return;

    setPendingActionId('repost-' + item.id);
    const accepted = await postSocialAction({
      targetType: item.postId ? 'posts' : 'signals',
      targetId: item.postId ?? item.signalId ?? '',
      userId: activeSession.user.id,
      action: 'bookmarks',
      method: nextReposted ? 'POST' : 'DELETE',
    });
    if (accepted && item.signalId) await refreshSignalParticipants(item.signalId);
    if (accepted) onTimelineRefresh?.();
    setPendingActionId(null);
  };

  const submitReply = async (event: React.FormEvent, item: ActivityItem) => {
    event.preventDefault();

    if (!requireCommunityIdentity()) {
      return;
    }

    const activeSession = session;
    if (!activeSession) return;

    const body = replyText.trim();
    if (!body) return;

    setPendingActionId('reply-' + item.id);

    let accepted = false;

    if (item.signalId) {
      const coreReply = await postSignalReply({ signalId: item.signalId, userId: activeSession.user.id, body });
      accepted = Boolean(coreReply);
      await refreshSignalParticipants(item.signalId);
    } else if (item.postId) {
      accepted = Boolean(await postPulseReply({ postId: item.postId, userId: activeSession.user.id, body }));
    } else if (item.position?.id) {
      accepted = Boolean(await postPositionReply({ positionId: item.position.id, userId: activeSession.user.id, body }));
    }

    if (accepted) {
      setReplyText('');
      setActiveReplyId(null);
      onTimelineRefresh?.();
    }

    setPendingActionId(null);
  };

  const requireCommunityIdentity = () => {
    if (!portfolio.connected || !session) {
      onRequireWallet();
      return false;
    }

    if (!hasCommunityIdentity) {
      setComposerStatus('Claim your .viction name to join Market Pulse.');
      return false;
    }

    return true;
  };

  const refreshSignalParticipants = async (signalId: string) => {
    const nextParticipants = await fetchSignalParticipants(signalId);
    setParticipants((current) => ({
      ...current,
      [signalId]: nextParticipants,
    }));
  };

  const savePreferences = async () => {
    if (!session?.user.id) {
      onRequireWallet();
      return;
    }

    const topics = preferenceDraft.split(',').map((item) => item.trim()).filter(Boolean);
    setMediaStatus('Saving preferences...');

    try {
      const response = await fetch('/api/preferences/' + encodeURIComponent(session.user.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics, regions: ['Global'], mediaTypes: ['image', 'video'], newsIntervalMinutes: 20, notifyInActivity: true }),
      });
      const body = (await response.json()) as PreferenceResponse;
      if (response.ok && body.ok) {
        setPreference(body.data.preference);
        setMediaStatus('Preferences saved. Fresh media feed is ready.');
        await refreshMediaFeed(session.user.id, setMediaItems, setMediaStatus);
      } else {
        setMediaStatus('Preference update failed.');
      }
    } catch {
      setMediaStatus('Preference update failed.');
    }
  };

  const generateNewsNow = async () => {
    if (!session?.user.id) {
      onRequireWallet();
      return;
    }

    setMediaStatus('Generating personalized market media...');

    try {
      const response = await fetch('/api/activity-media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, limit: 8 }),
      });
      const body = (await response.json()) as ActivityMediaResponse;
      if (response.ok && body.ok) {
        setMediaItems(body.data.items ?? []);
        setMediaStatus('Updated with personalized market media.');
      } else {
        setMediaStatus('Media generation is unavailable right now.');
      }
    } catch {
      setMediaStatus('Media generation is unavailable right now.');
    }
  };

  const toggleFollow = async (userId: string) => {
    if (!requireCommunityIdentity()) return;

    const activeSession = session;
    if (!activeSession || userId === activeSession.user.id) return;

    const isFollowing = followingIds.has(userId);
    setPendingActionId('follow-' + userId);
    const accepted = await postFollowAction({
      followerId: activeSession.user.id,
      followingId: userId,
      method: isFollowing ? 'DELETE' : 'POST',
    });

    if (accepted) {
      setFollowingIds((current) => {
        const next = new Set(current);
        if (isFollowing) next.delete(userId);
        else next.add(userId);
        return next;
      });
      setNetworkUsers((current) => current.map((user) =>
        user.user.id === userId
          ? {
              ...user,
              stats: {
                ...user.stats,
                followers: Math.max(0, user.stats.followers + (isFollowing ? -1 : 1)),
              },
              viewer: { isSelf: false, following: !isFollowing },
            }
          : user,
      ));
      onTimelineRefresh?.();
    }

    setPendingActionId(null);
  };

  return (
    <main className="flex-1 bg-grid-tech overflow-y-auto relative z-10 w-full min-h-[calc(100vh-64px)]">
      <div className="max-w-[1280px] mx-auto px-4 md:px-10 py-8 md:py-12 pb-32">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange mb-2">Prediction social</p>
            <h1 className="text-4xl font-sans font-bold text-white mb-2">Market Pulse</h1>
            <p className="max-w-2xl text-sm text-[#ccc3d8]">
              Discuss market moves, share sources, reply to traders, and keep event context tied to real markets.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded border border-[#262626] bg-[#101010] p-2 font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8] sm:flex">
            <PulseMetric label="Posts" value={feed.length} />
            <PulseMetric label="Markets" value={realMarkets.length} />
            <PulseMetric label="Profile" value={portfolio.connected ? 'Live' : 'Guest'} />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <section className="overflow-hidden rounded-lg border border-[#262626] bg-surface-card p-4 sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-deep-orange/30 bg-deep-orange/10 text-deep-orange">
                  <Radio size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Post to Pulse</h2>
                  <p className="text-sm text-[#ccc3d8]/80">Share a market take, source, meme, or trade idea with your .viction identity.</p>
                </div>
              </div>

              <CommunityIdentityNotice
                connected={portfolio.connected}
                handle={communityHandle}
                onRequireWallet={onRequireWallet}
              />

              <form className="grid gap-3" onSubmit={handlePostSubmit}>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
                  <div className="grid gap-2">
                    <textarea
                      className="min-h-28 min-w-0 resize-y rounded border border-[#262626] bg-[#0A0A0A] p-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-[#ccc3d8]/45 focus:border-deep-orange"
                      disabled={!portfolio.connected || !hasCommunityIdentity}
                      maxLength={500}
                      onChange={(event) => setNewPostText(event.target.value)}
                      placeholder={getComposerPlaceholder(portfolio.connected, hasCommunityIdentity)}
                      value={newPostText}
                    />
                    <div className="flex flex-wrap gap-1.5" aria-label="Quick Pulse stickers">
                      {QUICK_PULSE_STICKERS.map((sticker) => (
                        <button
                          className="grid h-8 w-8 place-items-center rounded border border-[#262626] bg-[#0A0A0A] text-base transition-colors hover:border-deep-orange hover:bg-deep-orange/10 disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={!portfolio.connected || !hasCommunityIdentity || newPostText.length + sticker.length > 500}
                          key={sticker}
                          onClick={() => setNewPostText((current) => (current + ' ' + sticker).trimStart())}
                          title={sticker}
                          type="button"
                        >
                          {sticker}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid min-w-0 gap-3">
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
                    <label className="grid min-w-0 gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8]/70">
                      Market optional
                      <select
                        className="min-h-11 w-full min-w-0 max-w-full truncate rounded border border-[#262626] bg-[#0A0A0A] p-2 text-xs text-white outline-none focus:border-deep-orange"
                        onChange={(event) => setSelectedMarketId(event.target.value)}
                        value={selectedMarket?.id ?? ''}
                      >
                        <option value="">General Pulse post</option>
                        {realMarkets.slice(0, 40).map((market) => (
                          <option key={market.id} value={market.id}>{market.title}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded bg-deep-orange px-4 py-2 font-sans text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!portfolio.connected || !hasCommunityIdentity || !newPostText.trim() || pendingActionId === 'compose'}
                      type="submit"
                    >
                      <Send size={14} />
                      {hasCommunityIdentity ? 'Publish' : 'Claim name'}
                    </button>
                  </div>
                </div>
                {composerStatus ? (
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8]/65">{composerStatus}</p>
                ) : null}
              </form>

              {publishedSignalId && selectedMarket ? (
                <ShareCardPanel
                  market={selectedMarket}
                  signalId={publishedSignalId}
                  text={composerSide + ' signal on ' + selectedMarket.title}
                  type="signal"
                />
              ) : null}
            </section>

            <NetworkInviteCard handle={communityHandle} connected={portfolio.connected} onRequireWallet={onRequireWallet} />

            <section className="rounded-lg border border-[#262626] bg-[#111111] p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  {(['for-you', 'following', 'live', 'markets', 'people', 'highlights'] as FeedTab[]).map((tab) => (
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

            {feedTab === 'highlights' ? (
              <PreferenceMediaPanel
                connected={portfolio.connected}
                draft={preferenceDraft}
                mediaItems={mediaItems}
                mediaStatus={mediaStatus}
                preference={preference}
                onDraftChange={setPreferenceDraft}
                onGenerate={() => void generateNewsNow()}
                onRequireWallet={onRequireWallet}
                onSave={() => void savePreferences()}
              />
            ) : feedTab === 'people' ? (
              <PeopleNetwork
                currentUserId={session?.user.id}
                networkStatus={networkStatus}
                pendingActionId={pendingActionId}
                users={networkUsers}
                onFollow={(userId) => void toggleFollow(userId)}
              />
            ) : (
            <div className="flex flex-col gap-4">
              {filteredFeed.length > 0 ? filteredFeed.map((item) => {
                const isSystem = item.type === 'system';
                const market = item.marketId ? markets.find((entry) => entry.id === item.marketId) : null;
                const replies = item.replies ?? [];
                const itemParticipants = item.signalId ? participants[item.signalId] : undefined;

                return (
                  <article
                    className="group relative rounded-lg border border-[#262626] bg-surface-card p-5 transition-colors hover:bg-[#1A1A1A]"
                    key={item.id}
                  >
                    <div className={`absolute left-0 top-0 hidden h-[2px] w-full rounded-t-lg opacity-70 group-hover:block ${isSystem ? 'bg-deep-orange' : 'bg-electric-purple'}`} />

                    <div className="flex items-start gap-4">
                      <ProfileHover item={item}>
                        <Avatar item={item} />
                      </ProfileHover>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <ProfileHover item={item} compact>
                              {item.traderProfileId ? (
                                <Link className={`font-mono text-sm font-bold transition-colors hover:text-deep-orange ${isSystem ? 'text-deep-orange' : 'text-white'}`} href={'/traders/' + item.traderProfileId}>
                                  {isSystem ? item.name : '@' + item.username}
                                </Link>
                              ) : (
                                <span className={`font-mono text-sm font-bold ${isSystem ? 'text-deep-orange' : 'text-white'}`}>
                                  {isSystem ? item.name : '@' + item.username}
                                </span>
                              )}
                            </ProfileHover>
                            <span className="rounded border border-[#262626] bg-[#0e0e0e] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/70">
                              {item.topic ?? getKindLabel(item.kind)}
                            </span>
                            <span className="font-mono text-[9px] uppercase tracking-widest text-[#ccc3d8]/55">{item.time}</span>
                          </div>
                          <FollowButton
                            actorUserId={item.actorUserId}
                            currentUserId={session?.user.id}
                            isFollowing={item.actorUserId ? followingIds.has(item.actorUserId) : false}
                            pending={item.actorUserId ? pendingActionId === 'follow-' + item.actorUserId : false}
                            onFollow={(userId) => void toggleFollow(userId)}
                          />
                        </div>

                        <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-[#ccc3d8]">{item.text}</p>

                        <SignalMeta item={item} />

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
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    className="rounded border border-deep-orange/40 bg-deep-orange/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange transition-colors hover:bg-deep-orange hover:text-black"
                                    onClick={() => setRoomMarket(market)}
                                    type="button"
                                  >
                                    Open room
                                  </button>
                                  <button
                                    className="inline-flex items-center gap-1.5 rounded border border-[#262626] bg-[#111] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] transition-colors hover:border-white/40 hover:text-white"
                                    onClick={() => setShareTargetMarket(market)}
                                    type="button"
                                  >
                                    <Share2 size={12} />
                                    Share
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        {!isSystem ? (
                          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-[#ccc3d8] font-mono text-[10px] uppercase font-bold tracking-widest">
                            {item.signalId || item.postId ? (
                              <>
                                <FeedAction active={item.likedByUser} busy={pendingActionId === 'like-' + item.id} count={item.likes} icon="heart" label="Like" onClick={() => void toggleLike(item)} />
                                <FeedAction active={item.repostedByUser} busy={pendingActionId === 'repost-' + item.id} count={item.repeats} icon="repeat" label="Repost" onClick={() => void toggleRepost(item)} />
                              </>
                            ) : null}
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

                        {!isSystem ? (
                          <SocialProof participants={itemParticipants} />
                        ) : null}

                        {market ? (
                          <MarketRoomTeaser
                            feedCount={feed.filter((entry) => entry.marketId === market.id).length}
                            market={market}
                            onOpen={() => setRoomMarket(market)}
                          />
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
                              placeholder={getReplyPlaceholder(portfolio.connected, hasCommunityIdentity)}
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
                  {realMarkets.length === 0
                    ? 'Market Pulse is waiting for core market data. Once markets return, users can post signals, replies, and sourced updates.'
                    : 'No posts match this filter yet. Start a market take or clear the search.'}
                </div>
              )}
            </div>
            )}
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
                {realMarkets.length > 0 ? realMarkets.slice(0, 5).map((market) => (
                  <article
                    className="rounded border border-[#262626] bg-[#0A0A0A] p-3 transition-colors hover:border-deep-orange/50 hover:bg-deep-orange/5"
                    key={market.id}
                  >
                    <button className="w-full text-left" onClick={() => setRoomMarket(market)} type="button">
                      <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/55">
                        {market.discoveryTopic ?? market.category}
                      </span>
                      <strong className="mt-1 line-clamp-2 block text-sm leading-snug text-white">{market.title}</strong>
                      <small className="mt-2 block font-mono text-[10px] text-deep-orange">YES {formatChance(market.currentOdds)}</small>
                    </button>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="inline-flex items-center gap-1.5 rounded border border-[#262626] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8] hover:border-white/40 hover:text-white"
                        onClick={() => setShareTargetMarket(market)}
                        type="button"
                      >
                        <Share2 size={11} />
                        Share
                      </button>
                      <button
                        className="inline-flex items-center gap-1.5 rounded border border-deep-orange/40 bg-deep-orange/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange hover:bg-deep-orange hover:text-black"
                        onClick={() => setRoomMarket(market)}
                        type="button"
                      >
                        Room
                      </button>
                    </div>
                  </article>
                )) : (
                  <p className="rounded border border-[#262626] bg-[#0A0A0A] p-4 text-sm text-[#ccc3d8]">
                    Market data is reconnecting. No placeholder watchlist is shown.
                  </p>
                )}
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

            <PulseFlowCard
              connected={portfolio.connected}
              hasCommunityIdentity={hasCommunityIdentity}
              onRequireWallet={onRequireWallet}
            />

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

      {shareTargetMarket ? (
        <ShareCardModal market={shareTargetMarket} onClose={() => setShareTargetMarket(null)} />
      ) : null}

      {roomMarket ? (
        <MarketRoomModal
          feed={roomFeed}
          market={roomMarket}
          onClose={() => setRoomMarket(null)}
          onOpenMarket={() => {
            setRoomMarket(null);
            onOpenMarket(roomMarket);
          }}
          onShare={() => setShareTargetMarket(roomMarket)}
        />
      ) : null}

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


const QUICK_PULSE_STICKERS = ['🔥', '📈', '🧠', '⚡', '🏆', '👀', '💎', '🛰️'];

function CommunityIdentityNotice({
  connected,
  handle,
  onRequireWallet,
}: {
  connected: boolean;
  handle: string;
  onRequireWallet: () => void;
}) {
  if (connected && handle) {
    return (
      <div className="mb-4 rounded border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-[#ccc3d8]">
        Posting as <strong className="font-mono text-emerald-300">@{handle}</strong>. Likes, reposts, and replies build your public market record.
      </div>
    );
  }

  if (connected) {
    return (
      <div className="mb-4 flex flex-col gap-3 rounded border border-deep-orange/30 bg-deep-orange/10 p-3 text-sm text-[#f3e8d5] sm:flex-row sm:items-center sm:justify-between">
        <span>Claim a .viction name before posting, liking, reposting, or replying.</span>
        <Link
          className="inline-flex min-h-9 items-center justify-center rounded border border-deep-orange bg-deep-orange px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white"
          href="/me/profile"
        >
          Claim name
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded border border-[#262626] bg-[#0A0A0A] p-3 text-sm text-[#ccc3d8] sm:flex-row sm:items-center sm:justify-between">
      <span>Sign in, claim a .viction name, then join Market Pulse.</span>
      <button
        className="inline-flex min-h-9 items-center justify-center rounded border border-deep-orange bg-deep-orange px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white"
        onClick={onRequireWallet}
        type="button"
      >
        Sign in
      </button>
    </div>
  );
}

function PreferenceMediaPanel({
  connected,
  draft,
  mediaItems,
  mediaStatus,
  onDraftChange,
  onGenerate,
  onRequireWallet,
  onSave,
  preference,
}: {
  connected: boolean;
  draft: string;
  mediaItems: ActivityMediaItem[];
  mediaStatus: string;
  onDraftChange: (value: string) => void;
  onGenerate: () => void;
  onRequireWallet: () => void;
  onSave: () => void;
  preference: UserPreference | null;
}) {
  return (
    <section className="rounded-lg border border-[#262626] bg-surface-card p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Highlights</p>
          <h2 className="mt-1 text-xl font-bold text-white">Market highlight cards</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#ccc3d8]">Set topics once, then open this tab for generated market cards and motion views.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex min-h-10 items-center justify-center rounded border border-[#262626] bg-[#0A0A0A] px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] hover:border-white/40 hover:text-white"
            onClick={connected ? onSave : onRequireWallet}
            type="button"
          >
            Save preferences
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded bg-deep-orange px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white"
            onClick={connected ? onGenerate : onRequireWallet}
            type="button"
          >
            <Sparkles size={13} />
            Generate highlights
          </button>
        </div>
      </div>

      <label className="grid gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8]/70">
        Topics
        <input
          className="min-h-11 rounded border border-[#262626] bg-[#0A0A0A] px-3 text-xs text-white outline-none focus:border-deep-orange"
          disabled={!connected}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Sports, World Cup, Crypto, Geopolitics"
          value={draft}
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-widest text-[#ccc3d8]/55">
        <span className="rounded border border-[#262626] bg-[#0A0A0A] px-2 py-1">Cadence {preference?.newsIntervalMinutes ?? 20} min</span>
        <span className="rounded border border-[#262626] bg-[#0A0A0A] px-2 py-1">Media image/video</span>
        <span className="rounded border border-[#262626] bg-[#0A0A0A] px-2 py-1">Telegram support ready</span>
      </div>
      {mediaStatus ? <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8]/65">{mediaStatus}</p> : null}

      {mediaItems.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {mediaItems.slice(0, 4).map((item) => (
            <article className="overflow-hidden rounded-lg border border-[#262626] bg-[#0A0A0A]" key={item.id}>
              {item.imageUrl ? (
                <img alt="" className="aspect-[1200/630] w-full object-cover" src={absoluteMediaUrl(item.imageUrl)} />
              ) : null}
              <div className="p-3">
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange">{item.kind}</p>
                <h3 className="mt-1 line-clamp-2 text-sm font-bold text-white">{item.title}</h3>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[#ccc3d8]">{item.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.marketId ? (
                    <Link className="rounded border border-deep-orange/40 bg-deep-orange/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange hover:bg-deep-orange hover:text-black" href={'/markets/' + item.marketId}>
                      Open market
                    </Link>
                  ) : null}
                  {item.videoUrl ? (
                    <a className="inline-flex items-center gap-1 rounded border border-[#262626] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8] hover:border-white/40 hover:text-white" href={absoluteMediaUrl(item.videoUrl)} rel="noreferrer" target="_blank">
                      <PlayCircle size={11} />
                      Motion
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function NetworkInviteCard({
  connected,
  handle,
  onRequireWallet,
}: {
  connected: boolean;
  handle: string;
  onRequireWallet: () => void;
}) {
  const inviteUrl = typeof window === 'undefined' ? 'https://convictionmarkets.xyz/activity' : window.location.origin + '/activity';
  const inviteText = handle
    ? 'Follow ' + handle + ' on Conviction Markets for prediction market takes and public trades.'
    : 'Join me on Conviction Markets, a leveraged marketplace for prediction markets.';

  return (
    <section className="rounded-lg border border-deep-orange/30 bg-[#161616] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Invite network</p>
          <h2 className="mt-1 text-xl font-bold text-white">Bring traders into Market Pulse</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#ccc3d8]">Share your profile, bring friends from social apps, and turn market takes into a real trader network.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <InviteAction label="Telegram" href="https://t.me/+KYjXR2Tz2P4xMGY0" />
          <InviteAction label="X" href={'https://twitter.com/intent/tweet?text=' + encodeURIComponent(inviteText) + '&url=' + encodeURIComponent(inviteUrl)} />
          <InviteAction label="WhatsApp" href={'https://wa.me/?text=' + encodeURIComponent(inviteText + ' ' + inviteUrl)} />
          <InviteAction label="Farcaster" href={'https://warpcast.com/~/compose?text=' + encodeURIComponent(inviteText + ' ' + inviteUrl)} />
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-[#262626] bg-[#0A0A0A] px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] hover:border-white/40 hover:text-white"
            onClick={() => void copyInstagramInvite(inviteText + ' ' + inviteUrl)}
            type="button"
          >
            <Instagram size={13} />
            Instagram
          </button>
        </div>
      </div>
      {!connected ? (
        <button
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded bg-deep-orange px-4 font-mono text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white"
          onClick={onRequireWallet}
          type="button"
        >
          Sign in to claim your invite card
        </button>
      ) : null}
    </section>
  );
}

function InviteAction({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-[#262626] bg-[#0A0A0A] px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] hover:border-deep-orange hover:text-deep-orange"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <SendIcon size={13} />
      {label}
    </a>
  );
}

function PeopleNetwork({
  currentUserId,
  networkStatus,
  onFollow,
  pendingActionId,
  users,
}: {
  currentUserId?: string;
  networkStatus: string;
  onFollow: (userId: string) => void;
  pendingActionId: string | null;
  users: DiscoveredUser[];
}) {
  const visibleUsers = users.filter(
    (user) => user.user.id !== currentUserId && isClaimedVictionProfile(user.traderProfile),
  );

  if (visibleUsers.length === 0) {
    return (
      <section className="rounded-lg border border-[#262626] bg-surface-card p-6 text-sm text-[#ccc3d8]">
        <div className="mb-3 grid h-10 w-10 place-items-center rounded-full border border-deep-orange/30 bg-deep-orange/10 text-deep-orange">
          <Users size={18} />
        </div>
        {networkStatus || 'No other users found yet.'}
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {visibleUsers.map((user) => {
        const label = getDiscoveredUserLabel(user);
        const avatar = user.traderProfile?.avatarUrl || user.socialAccount?.profileUrl;
        const following = Boolean(user.viewer?.following);

        return (
          <article className="rounded-lg border border-[#262626] bg-surface-card p-4" key={user.user.id}>
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 flex-shrink-0 place-items-center overflow-hidden rounded-full border border-[#262626] bg-[#252525] font-mono text-xs font-bold uppercase text-white">
                {avatar ? <img alt="" className="h-full w-full object-cover" src={avatar} /> : label.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <Link className="block truncate text-sm font-bold text-white hover:text-deep-orange" href={user.traderProfile ? '/traders/' + user.traderProfile.id : '/activity'}>
                  {label}
                </Link>
                <p className="mt-1 line-clamp-2 text-xs text-[#ccc3d8]/75">{user.traderProfile?.bio ?? user.user.displayName ?? 'Conviction network user'}</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-[9px] uppercase tracking-widest text-[#ccc3d8]/65">
                  <UserMetric label="Followers" value={user.stats.followers} />
                  <UserMetric label="Signals" value={user.stats.publicSignals} />
                  <UserMetric label="Trades" value={user.stats.publicPositions} />
                </dl>
              </div>
            </div>
            <button
              className={
                'mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded border px-3 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors disabled:cursor-wait disabled:opacity-60 ' +
                (following ? 'border-[#262626] bg-[#0A0A0A] text-[#ccc3d8] hover:border-white/40 hover:text-white' : 'border-deep-orange bg-deep-orange text-black hover:bg-white')
              }
              disabled={pendingActionId === 'follow-' + user.user.id || Boolean(user.viewer?.isSelf)}
              onClick={() => onFollow(user.user.id)}
              type="button"
            >
              <UserPlus size={13} />
              {following ? 'Following' : 'Follow'}
            </button>
          </article>
        );
      })}
    </section>
  );
}

function UserMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-[#262626] bg-[#0A0A0A] p-2">
      <dt>{label}</dt>
      <dd className="mt-1 text-xs font-bold text-white">{value}</dd>
    </div>
  );
}


function PulseFlowCard({
  connected,
  hasCommunityIdentity,
  onRequireWallet,
}: {
  connected: boolean;
  hasCommunityIdentity: boolean;
  onRequireWallet: () => void;
}) {
  const steps = [
    { label: 'Pick a room', body: 'Open the event room from a post or watchlist market.' },
    { label: 'Add a source', body: 'Reply with evidence, a counterpoint, or fresh news.' },
    { label: 'Make the call', body: 'Publish YES/NO conviction or open the market.' },
  ];

  return (
    <section className="rounded-lg border border-[#262626] bg-surface-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full border border-deep-orange/30 bg-deep-orange/10 text-deep-orange">
          <Radio size={18} />
        </div>
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Pulse flow</p>
          <h2 className="text-lg font-bold text-white">From news to conviction</h2>
        </div>
      </div>
      <div className="grid gap-3">
        {steps.map((step, index) => (
          <div className="rounded border border-[#262626] bg-[#0A0A0A] p-3" key={step.label}>
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange">0{index + 1}</span>
            <strong className="mt-1 block text-sm text-white">{step.label}</strong>
            <p className="mt-1 text-xs leading-relaxed text-[#ccc3d8]/75">{step.body}</p>
          </div>
        ))}
      </div>
      {!connected || !hasCommunityIdentity ? (
        <button
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded bg-deep-orange px-4 font-mono text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white"
          onClick={onRequireWallet}
          type="button"
        >
          Sign in to join rooms
        </button>
      ) : null}
    </section>
  );
}

function MarketRoomTeaser({ feedCount, market, onOpen }: { feedCount: number; market: PredictionMarket; onOpen: () => void }) {
  return (
    <button
      className="mb-4 flex w-full items-center justify-between gap-3 rounded border border-[#262626] bg-[#111] p-3 text-left transition-colors hover:border-deep-orange/50 hover:bg-deep-orange/5"
      onClick={onOpen}
      type="button"
    >
      <span className="min-w-0">
        <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange">Market room</span>
        <span className="mt-1 block truncate text-xs text-[#ccc3d8]">{feedCount} Pulse updates around {market.discoveryTopic ?? market.category ?? 'this event'}</span>
      </span>
      <span className="rounded border border-deep-orange/40 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange">Open</span>
    </button>
  );
}

function MarketRoomModal({
  feed,
  market,
  onClose,
  onOpenMarket,
  onShare,
}: {
  feed: ActivityItem[];
  market: PredictionMarket;
  onClose: () => void;
  onOpenMarket: () => void;
  onShare: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <section className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-xl border border-[#262626] bg-[#111111] shadow-2xl shadow-black/60" aria-label="Market room">
        <div className="flex items-start justify-between gap-4 border-b border-[#262626] bg-[#0A0A0A] p-4 sm:p-5">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Live market room</p>
            <h2 className="mt-1 line-clamp-2 text-xl font-bold text-white">{market.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2 font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/65">
              <span className="rounded border border-[#262626] bg-[#111] px-2 py-1">YES {formatChance(market.currentOdds)}</span>
              <span className="rounded border border-[#262626] bg-[#111] px-2 py-1">{market.discoveryTopic ?? market.category ?? 'Market'}</span>
              <span className="rounded border border-[#262626] bg-[#111] px-2 py-1">{feed.length} posts</span>
            </div>
          </div>
          <button
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded border border-[#262626] text-[#ccc3d8] transition-colors hover:border-white/40 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid max-h-[calc(88vh-8rem)] gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="p-4 sm:p-5">
            <div className="mb-4 rounded border border-deep-orange/30 bg-deep-orange/10 p-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Room brief</p>
              <p className="mt-1 text-sm leading-relaxed text-[#f3e8d5]">
                Watch the price, read sources from traders, then publish a take or open the market when your conviction is clear.
              </p>
            </div>

            {feed.length > 0 ? (
              <div className="grid gap-3">
                {feed.map((item) => (
                  <article className="rounded border border-[#262626] bg-[#0A0A0A] p-3" key={item.id}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <strong className="truncate font-mono text-xs text-white">@{item.username}</strong>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#ccc3d8]/55">{item.time}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#ccc3d8]">{item.text}</p>
                    <SignalMeta item={item} />
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded border border-[#262626] bg-[#0A0A0A] p-5 text-sm text-[#ccc3d8]">
                No Pulse posts are attached to this market yet. Be first with a source or conviction call.
              </div>
            )}
          </div>

          <aside className="border-t border-[#262626] bg-[#161616] p-4 lg:border-l lg:border-t-0">
            <div className="grid gap-3">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded bg-deep-orange px-4 font-mono text-[10px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-white"
                onClick={onOpenMarket}
                type="button"
              >
                Open market
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-[#262626] bg-[#0A0A0A] px-4 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] transition-colors hover:border-white/40 hover:text-white"
                onClick={onShare}
                type="button"
              >
                <Share2 size={13} />
                Share card
              </button>
            </div>
            <div className="mt-4 grid gap-2 rounded border border-[#262626] bg-[#0A0A0A] p-3 text-xs leading-relaxed text-[#ccc3d8]">
              <strong className="font-mono text-[10px] uppercase tracking-widest text-white">Room prompts</strong>
              <span>What changed?</span>
              <span>What source matters?</span>
              <span>What would resolve this?</span>
              <span>Where is the market mispriced?</span>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function FollowButton({
  actorUserId,
  currentUserId,
  isFollowing,
  onFollow,
  pending,
}: {
  actorUserId?: string;
  currentUserId?: string;
  isFollowing: boolean;
  onFollow: (userId: string) => void;
  pending: boolean;
}) {
  if (!actorUserId || actorUserId === currentUserId) return null;

  return (
    <button
      className={`w-fit rounded border px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors disabled:cursor-wait disabled:opacity-60 ${
        isFollowing
          ? 'border-[#262626] bg-[#0A0A0A] text-[#ccc3d8] hover:border-white/40 hover:text-white'
          : 'border-deep-orange bg-deep-orange text-black hover:bg-white'
      }`}
      disabled={pending}
      onClick={() => onFollow(actorUserId)}
      type="button"
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}

function SocialProof({ participants }: { participants?: SignalParticipants }) {
  if (!participants) return null;

  const rows = [
    { label: 'Liked by', actors: participants.reactions, icon: Heart },
    { label: 'Reposted by', actors: participants.bookmarks, icon: Repeat },
    { label: 'Commented by', actors: participants.commenters, icon: MessageSquare },
  ].filter((row) => row.actors.length > 0);

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2 rounded border border-[#262626] bg-[#0A0A0A] p-3">
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <div className="flex min-w-0 items-center gap-2 text-xs text-[#ccc3d8]" key={row.label}>
            <Icon className="flex-shrink-0 text-deep-orange" size={13} />
            <div className="flex min-w-0 items-center gap-2">
              <ActorStack actors={row.actors} />
              <span className="min-w-0 truncate">
                {row.label} <strong className="text-white">{formatActorList(row.actors)}</strong>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActorStack({ actors }: { actors: SocialActor[] }) {
  return (
    <div className="flex flex-shrink-0 -space-x-1.5">
      {actors.slice(0, 4).map((actor) => (
        <span
          className="grid h-6 w-6 place-items-center rounded-full border border-[#0A0A0A] bg-[#252525] font-mono text-[9px] font-bold uppercase text-white"
          key={actor.userId}
          title={getActorName(actor)}
        >
          {getActorInitials(actor)}
        </span>
      ))}
    </div>
  );
}

function Avatar({ item }: { item: ActivityItem }) {
  const inner = item.type === 'system'
    ? <AlertTriangle size={18} />
    : item.avatarUrl
      ? <img alt="" className="h-full w-full object-cover" src={item.avatarUrl} />
      : item.username.slice(0, 2).toUpperCase();

  const classes = item.type === 'system'
    ? 'w-10 h-10 rounded-full bg-deep-orange/10 border border-deep-orange/30 flex items-center justify-center text-deep-orange flex-shrink-0'
    : 'w-10 h-10 rounded-full overflow-hidden border border-[#282828] flex-shrink-0 bg-[#2a2a2a] flex items-center justify-center font-mono font-extrabold text-[#d2bbff] text-xs transition-colors hover:border-deep-orange';

  if (item.traderProfileId && item.type !== 'system') {
    return <Link className={classes} href={'/traders/' + item.traderProfileId}>{inner}</Link>;
  }

  return <div className={classes}>{inner}</div>;
}

function ProfileHover({ children, compact, item }: { children: React.ReactNode; compact?: boolean; item: ActivityItem }) {
  if (item.type === 'system') return <>{children}</>;

  return (
    <span className="group/profile relative inline-flex min-w-0">
      {children}
      <span className={(compact ? 'left-0 top-7' : 'left-0 top-12') + ' pointer-events-none absolute z-30 hidden w-64 rounded-lg border border-[#262626] bg-[#101010] p-3 text-left shadow-2xl group-hover/profile:block'}>
        <span className="flex items-start gap-3">
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center overflow-hidden rounded-full border border-[#282828] bg-[#252525] font-mono text-xs font-bold uppercase text-white">
            {item.avatarUrl ? <img alt="" className="h-full w-full object-cover" src={item.avatarUrl} /> : item.username.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-white">@{item.username}</span>
            <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-[#ccc3d8]/75">{item.name}</span>
          </span>
        </span>
        <span className="mt-3 flex items-center justify-between gap-2 font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/60">
          <span>{item.topic ?? getKindLabel(item.kind)}</span>
          <span>{item.traderProfileId ? 'View profile' : 'Profile pending'}</span>
        </span>
      </span>
    </span>
  );
}

function SignalMeta({ item }: { item: ActivityItem }) {
  if (!item.signalSide && !item.convictionLevel) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2 font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/65">
      {item.signalSide ? (
        <span className={"rounded border px-2 py-1 " + (item.signalSide === 'YES' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300')}>
          {item.signalSide} signal
        </span>
      ) : null}
      {item.convictionLevel ? (
        <span className="rounded border border-[#262626] bg-[#0A0A0A] px-2 py-1 text-[#ccc3d8]">
          Conviction {item.convictionLevel}%
        </span>
      ) : null}
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

function ShareCardPanel({
  market,
  onClose,
  signalId,
  text,
  type,
}: {
  market: PredictionMarket;
  onClose?: () => void;
  signalId?: string;
  text: string;
  type: 'market' | 'signal';
}) {
  const path = type === 'signal' && signalId ? '/signals/' + signalId : '/markets/' + market.id;
  const url = getShareUrl(path);
  const cardUrl = getShareUrl('/api/miniapp-image?type=' + type + '&id=' + encodeURIComponent(type === 'signal' && signalId ? signalId : market.id));
  const imageUrl = getMarketImageUrl(market);
  const category = market.discoveryTopic ?? market.category ?? 'Prediction market';
  const noChance = Number.isFinite(market.currentOdds) ? Math.max(0, 100 - market.currentOdds) : null;
  const shareText = text.trim() || market.title + ' on Conviction Markets';

  return (
    <div className="rounded-xl border border-[#262626] bg-[#0A0A0A] p-3 sm:p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-lg border border-[#262626] bg-[#050505]">
          <div className="relative aspect-[1200/630] overflow-hidden bg-[#070707]">
            {imageUrl ? (
              <img
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-45"
                decoding="async"
                loading="lazy"
                src={imageUrl}
              />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(7,7,7,0.94),rgba(14,14,14,0.78)_52%,rgba(217,91,19,0.22))]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:34px_34px] opacity-70" />
            <div className="relative flex h-full flex-col justify-between p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange">Conviction Markets</p>
                  <h3 className="mt-2 line-clamp-3 max-w-[34rem] text-xl font-black leading-tight text-white sm:text-3xl">{market.title}</h3>
                </div>
                <span className="rounded-full border border-deep-orange/40 bg-black/45 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-deep-orange">
                  {category}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <SharePreviewMetric label="YES" value={formatChance(market.currentOdds)} tone="yes" />
                <SharePreviewMetric label="NO" value={noChance === null ? '--' : formatChance(noChance)} tone="no" />
                <SharePreviewMetric label="24H" value={market.vol24h || '--'} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Share as image</p>
                <p className="mt-1 text-sm leading-relaxed text-[#ccc3d8]">Shares the generated card image where supported. The market link is copied into the caption.</p>
              </div>
              {onClose ? (
                <button
                  aria-label="Close share card"
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded border border-[#262626] text-[#ccc3d8] hover:border-white/40 hover:text-white"
                  onClick={onClose}
                  type="button"
                >
                  <X size={15} />
                </button>
              ) : null}
            </div>

            <div className="mt-3 rounded border border-[#262626] bg-[#050505] p-2 text-xs leading-relaxed text-[#ccc3d8]">
              {imageUrl ? 'Preview uses the lightweight listing image. The full social card is generated only when you share or download.' : 'This market has no listing image yet, so the generated card uses the Conviction branded fallback.'}
            </div>
          </div>

          <div className="grid gap-2">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-deep-orange px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-70"
              onClick={() => void nativeShareCard({ cardUrl, filename: 'conviction-market-' + market.id + '.png', title: market.title, text: shareText, url })}
              type="button"
            >
              <Share2 size={13} />
              Share image
            </button>
            <div className="grid grid-cols-2 gap-2">
              <ShareCardAction label="X" href={getXShareUrl(shareText, url)} />
              <ShareCardAction label="Telegram" href={getTelegramShareUrl(shareText, url)} />
              <ShareCardAction label="WhatsApp" href={'https://wa.me/?text=' + encodeURIComponent(shareText + ' ' + url)} />
              <ShareCardAction label="Farcaster" href={'https://warpcast.com/~/compose?text=' + encodeURIComponent(shareText) + '&embeds[]=' + encodeURIComponent(url)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded border border-[#262626] bg-[#111] px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] hover:border-white/40 hover:text-white"
                onClick={() => void copyShareText(shareText + ' ' + url)}
                type="button"
              >
                <Instagram size={13} />
                Copy caption
              </button>
              <a
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded border border-[#262626] bg-[#111] px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] hover:border-white/40 hover:text-white"
                download={'conviction-market-' + market.id + '.png'}
                href={cardUrl}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink size={12} />
                Image file
              </a>
            </div>
            <button
              className="inline-flex min-h-9 items-center justify-center rounded border border-[#262626] bg-transparent px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] hover:border-white/40 hover:text-white lg:hidden"
              onClick={onClose}
              type="button"
            >
              Back to Pulse
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SharePreviewMetric({ label, tone, value }: { label: string; tone?: 'yes' | 'no'; value: string }) {
  const valueClass = tone === 'yes' ? 'text-emerald-300' : tone === 'no' ? 'text-red-300' : 'text-white';

  return (
    <div className="min-w-0 rounded border border-[#262626] bg-[#050505] p-2">
      <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/55">{label}</span>
      <strong className={'mt-1 block truncate text-sm font-bold ' + valueClass}>{value}</strong>
    </div>
  );
}

function ShareCardAction({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="inline-flex min-h-9 items-center justify-center gap-2 rounded border border-[#262626] bg-[#111] px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] hover:border-deep-orange hover:text-deep-orange"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <Share2 size={12} />
      {label}
    </a>
  );
}

function ShareCardModal({ market, onClose }: { market: PredictionMarket; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Share market card">
      <button className="absolute inset-0 cursor-default" onClick={onClose} type="button" aria-label="Back to Pulse" />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-[#262626] bg-[#111111] p-3 shadow-2xl shadow-black/50 sm:max-w-5xl sm:rounded-xl sm:p-4">
        <ShareCardPanel
          market={market}
          onClose={onClose}
          text={market.title + ' on Conviction Markets'}
          type="market"
        />
      </div>
    </div>
  );
}

function getShareUrl(path: string) {
  const base = typeof window === 'undefined' ? 'https://convictionmarkets.xyz' : window.location.origin;
  return base + path;
}

function getXShareUrl(text: string, url: string) {
  return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
}

function getTelegramShareUrl(text: string, url: string) {
  return 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);
}

async function copyShareText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Copy is best-effort for social share text.
  }
}

async function nativeShareCard({
  cardUrl,
  filename,
  title,
  text,
  url,
}: {
  cardUrl: string;
  filename: string;
  title: string;
  text: string;
  url: string;
}) {
  const caption = text + ' ' + url;

  if (typeof navigator === 'undefined' || !navigator.share) {
    await copyShareText(caption);
    window.open(cardUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    const file = await getShareImageFile(cardUrl, filename);

    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: caption, title });
      return;
    }

    await navigator.share({ text: caption, title, url });
  } catch {
    // Native share can be cancelled by the user. Keep the caption available.
    await copyShareText(caption);
  }
}

async function getShareImageFile(cardUrl: string, filename: string) {
  try {
    const response = await fetch(cardUrl, { cache: 'force-cache' });

    if (!response.ok) return null;

    const blob = await response.blob();
    const type = blob.type || 'image/png';

    return new File([blob], filename, { type });
  } catch {
    return null;
  }
}

function TradeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#262626] bg-[#050505] p-3">
      <dt className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccc3d8]/50">{label}</dt>
      <dd className="mt-1 font-mono text-xs font-bold text-white">{value}</dd>
    </div>
  );
}

function normalizeActivityFeed(activity: ActivityItem[]) {
  return dedupeActivityItems(activity.map((item) => ({
    ...item,
    kind: item.kind ?? 'signal',
    replies: item.replies ?? [],
    topic: item.topic ?? 'Signal',
  })));
}

function dedupeActivityItems(items: ActivityItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function filterFeed(feed: ActivityItem[], tab: FeedTab, query: string, followingIds: Set<string>) {
  const normalizedQuery = query.trim().toLowerCase();

  return feed.filter((item) => {
    if (tab === 'highlights' || tab === 'people') return false;
    if (tab === 'following' && (!item.actorUserId || !followingIds.has(item.actorUserId))) return false;
    if (tab === 'live' && !item.marketId && item.kind !== 'news' && item.kind !== 'trade') return false;
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
  if (tab === 'for-you') return 'For You';
  if (tab === 'following') return 'Following';
  if (tab === 'live') return 'Live';
  if (tab === 'people') return 'People';
  if (tab === 'highlights') return 'Highlights';
  if (tab === 'markets') return 'Markets';
  if (tab === 'trades') return 'Trades';
  return 'Pulse';
}

function getKindLabel(kind: ActivityItem['kind']) {
  if (kind === 'news') return 'News';
  if (kind === 'trade') return 'Trade';
  if (kind === 'post') return 'Post';
  if (kind === 'signal') return 'Signal';
  return 'Pulse';
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


function getSessionUsername(session: UserSession | null, portfolio: UserPortfolio) {
  return normalizeVictionLabel(session?.traderProfile?.handle ?? session?.socialAccount?.username, portfolio.connected ? 'trader' : 'guest');
}

function getSessionDisplayName(session: UserSession | null, portfolio: UserPortfolio) {
  return normalizeVictionLabel(session?.traderProfile?.handle ?? session?.socialAccount?.username ?? session?.user.displayName, portfolio.connected ? 'trader' : 'Conviction trader');
}

function parseFollowingIds(body: unknown) {
  if (!body || typeof body !== 'object' || !('ok' in body)) return [];
  const response = body as { ok?: boolean; data?: { following?: Array<{ followingId: string }> } };

  return response.ok && Array.isArray(response.data?.following)
    ? response.data.following.map((item) => item.followingId)
    : [];
}

async function postFollowAction({
  followerId,
  followingId,
  method,
}: {
  followerId: string;
  followingId: string;
  method: 'POST' | 'DELETE';
}) {
  try {
    const response = await fetch('/api/social/follows', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerId, followingId }),
    });
    const body = (await response.json()) as { ok?: boolean };

    return response.ok && body.ok;
  } catch {
    return false;
  }
}

async function postPositionReply({ positionId, userId, body }: { positionId: string; userId: string; body: string }): Promise<boolean> {
  try {
    const response = await fetch('/api/social/positions/' + encodeURIComponent(positionId) + '/replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorUserId: userId, body }),
    });
    const parsed = (await response.json()) as { ok?: boolean };

    return response.ok && parsed.ok === true;
  } catch {
    return false;
  }
}

async function postSocialAction({
  action,
  method,
  targetId,
  targetType,
  userId,
}: {
  action: 'reactions' | 'bookmarks';
  method: 'POST' | 'DELETE';
  targetId: string;
  targetType: 'signals' | 'posts';
  userId: string;
}) {
  try {
    const response = await fetch('/api/social/' + targetType + '/' + encodeURIComponent(targetId) + '/' + action, {
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

async function postPulseReply({ postId, userId, body }: { postId: string; userId: string; body: string }) {
  try {
    const response = await fetch('/api/social/posts/' + encodeURIComponent(postId) + '/replies', {
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


function getComposerPlaceholder(connected: boolean, hasCommunityIdentity: boolean) {
  if (!connected) return 'Sign in to join Market Pulse';
  if (!hasCommunityIdentity) return 'Claim a .viction name before posting';
  return 'What changed, and how should the market price it?';
}

function getReplyPlaceholder(connected: boolean, hasCommunityIdentity: boolean) {
  if (!connected) return 'Sign in to reply';
  if (!hasCommunityIdentity) return 'Claim a .viction name before replying';
  return 'Reply with a source, angle, or counterpoint...';
}

function getMarketImageUrl(market: PredictionMarket) {
  const imageUrl = market.imageUrl?.trim();

  return imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : null;
}

async function refreshMediaFeed(
  userId: string,
  setItems: (items: ActivityMediaItem[]) => void,
  setStatus: (status: string) => void,
) {
  try {
    const params = new URLSearchParams({ userId, limit: '12' });
    const response = await fetch('/api/activity-media?' + params.toString());
    const body = (await response.json()) as ActivityMediaResponse;
    const items = response.ok && body.ok ? body.data.items ?? [] : [];
    setItems(items);
    if (items.length === 0) setStatus('Set preferences, then generate personalized market media.');
  } catch {
    setItems([]);
    setStatus('Personalized media feed is unavailable right now.');
  }
}

function absoluteMediaUrl(value: string) {
  if (value.startsWith('http')) return value;
  if (typeof window === 'undefined') return value;
  return window.location.origin + value;
}

async function fetchSignalParticipants(signalId: string): Promise<SignalParticipants> {
  try {
    const response = await fetch('/api/social/signals/' + encodeURIComponent(signalId) + '/participants?limit=12');
    const body = (await response.json()) as ParticipantsResponse;

    if (!response.ok || !body.ok || !body.data.participants) {
      return emptyParticipants();
    }

    return {
      reactions: body.data.participants.reactions ?? [],
      bookmarks: body.data.participants.bookmarks ?? [],
      commenters: body.data.participants.commenters ?? [],
    };
  } catch {
    return emptyParticipants();
  }
}

function emptyParticipants(): SignalParticipants {
  return { reactions: [], bookmarks: [], commenters: [] };
}

function formatActorList(actors: SocialActor[]) {
  const names = actors.map(getActorName).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return names[0] + ' and ' + names[1];
  return names[0] + ', ' + names[1] + ' and ' + (names.length - 2) + ' others';
}

function getActorName(actor: SocialActor) {
  return normalizeVictionLabel(actor.handle ?? actor.username ?? actor.displayName, 'trader' + actor.userId.slice(-5));
}

function getActorInitials(actor: SocialActor) {
  const name = getActorName(actor).replace(/^@/, '');
  return name.slice(0, 2) || 'CM';
}

function getDiscoveredUserLabel(user: DiscoveredUser) {
  if (isClaimedVictionHandle(user.traderProfile?.handle)) {
    return normalizeVictionLabel(user.traderProfile?.handle, 'trader');
  }

  return 'Profile pending';
}

function normalizeVictionLabel(value: string | null | undefined, fallback: string) {
  const clean = (value ?? '').trim().replace(/^@/, '');
  if (!clean || /^0x[a-f0-9]{8,}/i.test(clean) || clean.includes('...')) return fallback.endsWith('.viction') ? fallback : fallback + '.viction';
  return clean.endsWith('.viction') ? clean : clean + '.viction';
}

async function copyInstagramInvite(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Copy is best-effort for social invite text.
  }
}

function formatChance(value: number) {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(1) + '%';
}
