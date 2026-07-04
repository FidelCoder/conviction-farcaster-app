"use client";

import {
  Bot,
  CheckCircle2,
  FolderOpen,
  LifeBuoy,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { TerminalShell } from "../../components/TerminalShell";
import {
  getSessionWalletAddress,
  getStoredBrowserWalletSession,
} from "../../lib/browser-wallet-session";
import {
  getExecutionCapabilities,
  listMarkets,
  type ExecutionCapabilities,
  type SupportTicket,
  type UserSession,
} from "../../lib/core-api";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  mode?: "ai" | "fallback";
};

type SupportAiResponse =
  | { ok: true; data: { answer: string; mode: "ai" | "fallback" } }
  | { ok: false; error: { message: string } };

type SupportTicketResponse =
  | { ok: true; data: { ticket: SupportTicket } }
  | { ok: false; error: { message: string } };

type SupportTicketsResponse =
  | { ok: true; data: { tickets: SupportTicket[] } }
  | { ok: false; error: { message: string } };

type SupportReplyResponse =
  | { ok: true; data: { ticket: SupportTicket } }
  | { ok: false; error: { message: string } };

const supportEmail = "convictionsmarket@gmail.com";

const starterMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Ask anything about Conviction Markets. I can help with market rules, margin requests, vault liquidity, wallet sessions, .viction profiles, Pulse, portfolio, and support tickets.",
    mode: "fallback",
  },
];

const quickQuestions = [
  "How does Conviction differ from Polymarket?",
  "What risk do vault liquidity providers take?",
  "How do margin requests become onchain trades?",
  "Why should I connect my wallet?",
] as const;

export default function SupportPage() {
  const [terminalData, setTerminalData] = useState<{
    execution: ExecutionCapabilities;
    marketCount: number;
  } | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [draft, setDraft] = useState(
    "How do vaults, margin, and prediction markets work together?",
  );
  const [askStatus, setAskStatus] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("Support request");
  const [summary, setSummary] = useState("");
  const [ticketStatus, setTicketStatus] = useState("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyStatus, setReplyStatus] = useState("");

  useEffect(() => {
    void Promise.all([getExecutionCapabilities(), listMarkets()]).then(([execution, markets]) => {
      setTerminalData({ execution, marketCount: markets.length });
    });

    const storedSession = getStoredBrowserWalletSession();
    setSession(storedSession);
    setEmail(storedSession?.user.email ?? "");
  }, []);

  const wallet = useMemo(() => getSessionWalletAddress(session), [session]);
  const handle = session?.traderProfile?.handle ?? (wallet ? shortWallet(wallet) : "guest");
  const transcript = useMemo(() => formatTranscript(messages), [messages]);
  const activeTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === activeTicketId) ?? tickets[0] ?? null,
    [activeTicketId, tickets],
  );

  const loadTickets = useCallback(async () => {
    const params = new URLSearchParams();
    if (session?.user.id) params.set("userId", session.user.id);
    else if (email.trim()) params.set("email", email.trim());
    else return;
    params.set("limit", "20");

    try {
      const response = await fetch("/api/support/tickets?" + params.toString());
      const body = (await response.json()) as SupportTicketsResponse;

      if (response.ok && body.ok) {
        setTickets(body.data.tickets);
        setActiveTicketId((current) => current ?? body.data.tickets[0]?.id ?? null);
      }
    } catch {
      // Ticket history is best effort; chat remains usable.
    }
  }, [email, session?.user.id]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  async function submitChat(event?: FormEvent<HTMLFormElement>, overrideQuestion?: string) {
    event?.preventDefault();

    const question = (overrideQuestion ?? draft).trim();
    if (!question) {
      setAskStatus("Ask a question first.");
      return;
    }

    const userMessage: ChatMessage = {
      id: "user-" + Date.now(),
      role: "user",
      content: question,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setDraft("");
    setAskStatus("Thinking...");

    try {
      const response = await fetch("/api/support/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          context:
            "Support tab chat. User: " +
            handle +
            (wallet ? ". Wallet: " + wallet : ". No wallet connected."),
          conversation: messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });
      const body = (await response.json()) as SupportAiResponse;

      if (!response.ok || !body.ok) {
        setAskStatus(body.ok ? "Support AI unavailable." : body.error.message);
        setMessages([
          ...nextMessages,
          {
            id: "assistant-error-" + Date.now(),
            role: "assistant",
            content:
              "I could not answer that right now. Create a ticket and the team will receive the thread through Telegram support.",
            mode: "fallback",
          },
        ]);
        return;
      }

      const assistantMessage: ChatMessage = {
        id: "assistant-" + Date.now(),
        role: "assistant",
        content: body.data.answer,
        mode: body.data.mode,
      };

      setMessages([...nextMessages, assistantMessage]);
      setAskStatus(
        body.data.mode === "ai"
          ? "Answered by Conviction AI."
          : "Answered with built-in Conviction context.",
      );
      if (!summary.trim()) setSummary(question + "\n\n" + body.data.answer);
    } catch {
      setAskStatus("Support AI is unavailable right now.");
      setMessages([
        ...nextMessages,
        {
          id: "assistant-network-" + Date.now(),
          role: "assistant",
          content:
            "The support assistant is unavailable right now. Create a ticket with your email and issue summary so the team can follow up.",
          mode: "fallback",
        },
      ]);
    }
  }

  async function createTicket() {
    const cleanEmail = email.trim();
    const cleanSummary =
      summary.trim() || latestUserMessage(messages) || "Support chat escalation requested.";
    const cleanSubject = subject.trim() || "Support request";

    if (!cleanEmail || !cleanSummary) {
      setTicketStatus("Email and issue summary are required.");
      return;
    }

    setTicketStatus("Creating support ticket...");

    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session?.user.id ?? null,
          wallet,
          email: cleanEmail,
          subject: cleanSubject,
          summary: cleanSummary,
          transcript,
        }),
      });
      const body = (await response.json()) as SupportTicketResponse;

      if (!response.ok || !body.ok) {
        setTicketStatus(body.ok ? "Ticket could not be created." : body.error.message);
        return;
      }

      setTickets((current) => [
        body.data.ticket,
        ...current.filter((ticket) => ticket.id !== body.data.ticket.id),
      ]);
      setActiveTicketId(body.data.ticket.id);
      setTicketStatus(
        body.data.ticket.telegramSentAt
          ? "Ticket created and sent to Telegram support."
          : "Ticket created. Telegram delivery will activate when bot env is configured.",
      );
    } catch {
      setTicketStatus("Ticket could not be created right now.");
    }
  }

  async function sendTicketReply() {
    if (!activeTicket) {
      setReplyStatus("Select a ticket first.");
      return;
    }

    const bodyText = replyDraft.trim();
    if (!bodyText) {
      setReplyStatus("Write a reply first.");
      return;
    }

    setReplyStatus("Sending reply...");

    try {
      const response = await fetch(
        "/api/support/tickets/" + encodeURIComponent(activeTicket.id) + "/replies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: session?.user.id ?? null,
            subject: "Follow-up from Support page",
            body: bodyText,
          }),
        },
      );
      const body = (await response.json()) as SupportReplyResponse;

      if (!response.ok || !body.ok) {
        setReplyStatus(body.ok ? "Reply could not be saved." : body.error.message);
        return;
      }

      setTickets((current) =>
        current.map((ticket) => (ticket.id === body.data.ticket.id ? body.data.ticket : ticket)),
      );
      setReplyDraft("");
      setReplyStatus("Reply added to this ticket.");
    } catch {
      setReplyStatus("Reply could not be sent right now.");
    }
  }

  return (
    <TerminalShell
      activeTab="support"
      execution={terminalData?.execution ?? fallbackExecution}
      marketCount={terminalData?.marketCount ?? 0}
      onSessionChange={(nextSession) => {
        setSession(nextSession);
        setEmail(nextSession?.user.email ?? "");
      }}
      sessionOverride={session ?? undefined}
    >
      <main className="terminal-page px-4 py-8 sm:px-6 lg:px-10">
        <section className="mx-auto max-w-7xl">
          <header className="mb-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <p className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#ff9b6a]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff9b6a]" />
                Support
              </p>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Conviction help desk
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#c9c3d2]">
                Chat with Conviction AI, then escalate into a support thread when a human needs to
                step in.
              </p>
            </div>

            <div className="rounded border border-[#2a2a2a] bg-[#121212] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.22)]">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center border border-[#d8d5dc] bg-[#080808] text-[#00f0a8]">
                  <Mail size={17} />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-[#9b94a8]">
                    Support mail
                  </p>
                  <p className="mt-1 break-all font-mono text-xs font-bold text-[#00f0a8]">
                    {supportEmail}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_390px]">
            <section className="rounded border border-[#2a2a2a] bg-[#141414] shadow-[0_28px_90px_rgba(0,0,0,0.3)]">
              <div className="flex items-center justify-between gap-4 border-b border-[#d8d5dc] px-6 py-5">
                <div className="flex items-center gap-4">
                  <span className="grid h-11 w-11 place-items-center border border-[#ff9b6a]/45 bg-[#2b1b14] text-[#ff9b6a]">
                    <Bot size={20} />
                  </span>
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffb18a]">
                      AI support chat
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-white">Chat with Conviction AI</h2>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#d8d5dc] bg-[#080808] px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#c9c3d2]">
                  <span className="h-2 w-2 rounded-full bg-[#00f0a8]" />
                  Online
                </span>
              </div>

              <div className="px-6 py-5">
                <div className="grid gap-5">
                  <div className="grid gap-5">
                    {messages.map((message) => (
                      <SupportChatRow key={message.id} message={message} />
                    ))}
                  </div>

                  <div className="grid gap-3 pl-12">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-[#9b94a8]">
                      Built-in context
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {quickQuestions.map((question) => (
                        <button
                          className="border border-[#d8d5dc] bg-[#080808] px-3 py-2 text-left font-mono text-[10px] text-[#c9c3d2] transition hover:border-[#ff8b45] hover:text-white"
                          key={question}
                          onClick={() => void submitChat(undefined, question)}
                          type="button"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>

                  {draft.trim() ? (
                    <div className="flex justify-end gap-3 pl-12">
                      <div className="max-w-[75%] border border-[#5a3524] bg-[#241913] px-4 py-4 text-base leading-relaxed text-white shadow-[0_12px_50px_rgba(255,106,27,0.08)]">
                        {draft}
                      </div>
                      <span className="grid h-9 w-9 shrink-0 place-items-center border border-[#ff9b6a]/45 bg-[#21140f] text-[#ff9b6a]">
                        <UserRound size={15} />
                      </span>
                    </div>
                  ) : null}
                </div>

                <form className="mt-8 grid gap-3" onSubmit={(event) => void submitChat(event)}>
                  <div className="rounded border border-[#8f8798] bg-[#080808] p-4">
                    <textarea
                      className="min-h-24 w-full resize-y border-none bg-transparent font-mono text-sm leading-relaxed text-white outline-none placeholder:text-[#8f8798]"
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="> Enter your query..."
                      value={draft}
                    />
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {askStatus ? (
                        <p className="font-mono text-[10px] uppercase tracking-widest text-[#9b94a8]">
                          {askStatus}
                        </p>
                      ) : (
                        <span />
                      )}
                      <button
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded bg-[#ff8b45] px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-black transition hover:bg-white"
                        type="submit"
                      >
                        <Send size={13} />
                        Send
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>

            <aside className="grid gap-6 content-start">
              <section className="rounded border border-[#2a2a2a] bg-[#141414] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                <div className="mb-5 flex items-center gap-4 border-b border-[#d8d5dc] pb-5">
                  <span className="grid h-11 w-11 place-items-center border border-[#00f0a8]/35 bg-[#062017] text-[#00f0a8]">
                    <LifeBuoy size={20} />
                  </span>
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#00f0a8]">
                      Human support
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-white">Escalate the chat</h2>
                  </div>
                </div>

                <p className="mb-6 border-l border-[#d8d5dc] pl-4 font-mono text-xs leading-relaxed text-[#b9b2c4]">
                  Tickets go to Telegram support. Replies return to this page.
                </p>

                <div className="grid gap-5">
                  <label className="grid gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b94a8]">
                    Email
                    <input
                      className="min-h-12 rounded border border-[#8f8798] bg-[#080808] px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[#00f0a8]"
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@domain.com"
                      type="email"
                      value={email}
                    />
                  </label>
                  <label className="grid gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b94a8]">
                    Subject
                    <input
                      className="min-h-12 rounded border border-[#8f8798] bg-[#080808] px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[#00f0a8]"
                      onChange={(event) => setSubject(event.target.value)}
                      value={subject}
                    />
                  </label>
                  <label className="grid gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b94a8]">
                    Issue summary
                    <textarea
                      className="min-h-32 resize-y rounded border border-[#8f8798] bg-[#080808] p-3 text-sm normal-case tracking-normal text-white outline-none placeholder:text-[#8f8798] focus:border-[#00f0a8]"
                      onChange={(event) => setSummary(event.target.value)}
                      placeholder="What needs human intervention?"
                      value={summary}
                    />
                  </label>
                  <button
                    className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#00f0a8] bg-[#112019] px-4 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00f0a8] transition hover:bg-[#00f0a8] hover:text-black"
                    onClick={() => void createTicket()}
                    type="button"
                  >
                    <Send size={13} />
                    Send ticket
                  </button>
                  {ticketStatus ? (
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#9b94a8]">
                      {ticketStatus}
                    </p>
                  ) : null}
                </div>
              </section>

              {supportCards.map((card) => {
                const Icon = card.icon;
                return (
                  <article
                    className="rounded border border-[#2a2a2a] border-l-[#ff9b6a] bg-[#141414] p-5"
                    key={card.title}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="text-[#ff9b6a]" size={16} />
                      <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#f7d6c5]">
                        {card.title}
                      </h3>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-[#b9b2c4]">{card.body}</p>
                  </article>
                );
              })}
            </aside>
          </div>

          <section className="mt-10 overflow-hidden rounded border border-[#2a2a2a] bg-[#111111] shadow-[0_24px_90px_rgba(0,0,0,0.26)]">
            <div className="flex flex-col gap-3 border-b border-[#d8d5dc] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid h-9 w-9 place-items-center border border-[#d8d5dc] bg-[#080808] text-[#f7d6c5]">
                  <RefreshCw size={15} />
                </span>
                <h2 className="text-2xl font-bold text-white">Support history</h2>
              </div>
              <button
                className="inline-flex items-center gap-2 border border-[#5a3524] bg-[#111111] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ffb18a] transition hover:border-[#ff8b45] hover:text-white"
                onClick={() => void loadTickets()}
                type="button"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>

            {tickets.length === 0 ? (
              <div className="grid min-h-[260px] place-items-center px-6 py-12 text-center">
                <div>
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded border border-[#8f8798] bg-[#1b1b1d] text-[#9b94a8]">
                    <FolderOpen size={28} />
                  </span>
                  <p className="mt-7 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-white">
                    NO_RECORDS_FOUND // WALLET_OR_EMAIL
                  </p>
                  <p className="mt-3 text-base text-[#c9c3d2]">
                    Create a ticket to initialize a support sequence.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
                <div className="border-b border-[#2a2a2a] p-4 lg:border-b-0 lg:border-r">
                  <div className="grid gap-2">
                    {tickets.map((ticket) => (
                      <button
                        className={`border p-3 text-left transition ${activeTicket?.id === ticket.id ? "border-[#ff8b45] bg-[#2b1b14]" : "border-[#2a2a2a] bg-[#080808] hover:border-[#ff8b45]/50"}`}
                        key={ticket.id}
                        onClick={() => setActiveTicketId(ticket.id)}
                        type="button"
                      >
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[#9b94a8]">
                          {shortTicket(ticket.id)} · {ticket.status}
                        </span>
                        <strong className="mt-1 block text-sm text-white">{ticket.subject}</strong>
                        <span className="mt-1 block truncate text-xs text-[#c9c3d2]">
                          {ticket.summary}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5">
                  {activeTicket ? (
                    <div>
                      <div className="mb-4 flex flex-col gap-2 border-b border-[#2a2a2a] pb-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-widest text-[#ff9b6a]">
                            Ticket {shortTicket(activeTicket.id)}
                          </p>
                          <h3 className="mt-1 text-xl font-bold text-white">
                            {activeTicket.subject}
                          </h3>
                          <p className="mt-2 text-sm leading-relaxed text-[#c9c3d2]">
                            {activeTicket.summary}
                          </p>
                        </div>
                        <span className="inline-flex w-fit items-center gap-1 border border-[#2a2a2a] bg-[#080808] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-white">
                          {activeTicket.status === "RESOLVED" ||
                          activeTicket.status === "CLOSED" ? (
                            <CheckCircle2 size={12} />
                          ) : null}
                          {activeTicket.status}
                        </span>
                      </div>

                      <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1">
                        <ThreadBubble
                          author="You"
                          body={activeTicket.summary}
                          createdAt={activeTicket.createdAt}
                          subject={activeTicket.subject}
                          type="USER"
                        />
                        {(activeTicket.replies ?? []).map((reply) => (
                          <ThreadBubble
                            author={
                              reply.authorName ??
                              (reply.authorType === "SUPPORT" ? "Conviction Support" : "You")
                            }
                            body={reply.body}
                            createdAt={reply.createdAt}
                            key={reply.id}
                            subject={reply.subject}
                            type={reply.authorType}
                          />
                        ))}
                      </div>

                      {activeTicket.status === "CLOSED" ? (
                        <p className="mt-4 border border-[#2a2a2a] bg-[#080808] p-3 text-sm text-[#c9c3d2]">
                          This ticket is closed. Create a new ticket if you still need help.
                        </p>
                      ) : (
                        <div className="mt-4 grid gap-3">
                          <textarea
                            className="min-h-24 resize-y rounded border border-[#8f8798] bg-[#080808] p-3 text-sm text-white outline-none focus:border-[#ff8b45]"
                            onChange={(event) => setReplyDraft(event.target.value)}
                            placeholder="Reply to this support thread..."
                            value={replyDraft}
                          />
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <button
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded bg-[#ff8b45] px-4 font-mono text-[10px] font-bold uppercase tracking-widest text-black transition hover:bg-white"
                              onClick={() => void sendTicketReply()}
                              type="button"
                            >
                              <Send size={14} />
                              Reply to ticket
                            </button>
                            {replyStatus ? (
                              <p className="font-mono text-[10px] uppercase tracking-widest text-[#9b94a8]">
                                {replyStatus}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        </section>
      </main>
    </TerminalShell>
  );
}

function SupportChatRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <article className={"flex gap-3 " + (isUser ? "justify-end" : "justify-start")}>
      {!isUser ? (
        <span className="grid h-8 w-8 shrink-0 place-items-center border border-[#d8d5dc] bg-[#080808] text-[#f7d6c5]">
          <Bot size={14} />
        </span>
      ) : null}
      <div
        className={
          "max-w-[82%] border px-4 py-3 text-sm leading-relaxed " +
          (isUser
            ? "border-[#5a3524] bg-[#241913] text-white"
            : "border-[#d8d5dc] bg-[#181818] text-white")
        }
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && message.mode ? (
          <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-[#9b94a8]">
            {message.mode === "ai" ? "Conviction AI" : "Built-in context"}
          </p>
        ) : null}
      </div>
      {isUser ? (
        <span className="grid h-8 w-8 shrink-0 place-items-center border border-[#d8d5dc] bg-[#080808] text-[#f7d6c5]">
          <UserRound size={14} />
        </span>
      ) : null}
    </article>
  );
}

function ThreadBubble({
  author,
  body,
  createdAt,
  subject,
  type,
}: {
  author: string;
  body: string;
  createdAt: string;
  subject?: string | null;
  type: string;
}) {
  const isSupport = type === "SUPPORT";

  return (
    <article
      className={
        "rounded-lg border p-3 " +
        (isSupport ? "border-deep-orange/35 bg-deep-orange/10" : "border-[#262626] bg-[#0A0A0A]")
      }
    >
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <strong className="text-sm text-white">{author}</strong>
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#ccc3d8]/50">
          {formatDate(createdAt)}
        </span>
      </div>
      {subject ? (
        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-deep-orange">
          {subject}
        </p>
      ) : null}
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#e5e2e1]">{body}</p>
    </article>
  );
}

const supportCards = [
  {
    title: "Telegram support",
    body: "Human escalation is routed to Telegram support and replies return to this page. Support mail is convictionsmarket@gmail.com.",
    icon: Send,
  },
  {
    title: "Wallet context",
    body: "When connected, tickets include the active wallet and user id so support can trace account-specific issues.",
    icon: ShieldCheck,
  },
] as const;

const fallbackExecution: ExecutionCapabilities = {
  evmOnly: true,
  architecture: "INTENT_FIRST_MULTICHAIN_MARGIN_LAYER",
  spotExecutionEnabled: false,
  marginExecutionEnabled: false,
  leverageEnabled: false,
  leverageRequiresContracts: true,
  activeAdapters: [],
  recommendation: "Connect core API for live execution capabilities.",
  chains: [],
};

function formatTranscript(messages: ChatMessage[]) {
  return messages
    .map((message) => (message.role === "assistant" ? "Assistant: " : "User: ") + message.content)
    .join("\n\n")
    .slice(-5000);
}

function latestUserMessage(messages: ChatMessage[]) {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  return latest?.content ?? "";
}

function shortWallet(wallet: string) {
  return wallet.slice(0, 6) + "..." + wallet.slice(-4);
}

function shortTicket(id: string) {
  return "#" + id.slice(-6);
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
