"use client";

import { Bot, LifeBuoy, Mail, Send, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { TerminalShell } from "../../components/TerminalShell";
import { getSessionWalletAddress, getStoredBrowserWalletSession } from "../../lib/browser-wallet-session";
import {
  getExecutionCapabilities,
  listMarkets,
  type ExecutionCapabilities,
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
  | { ok: true; data: { ticket: { id: string; status: string; telegramSentAt: string | null } } }
  | { ok: false; error: { message: string } };

const starterMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "I can help with Conviction Markets: market rules, margin requests, vault liquidity, wallet sessions, .viction profiles, Activity, portfolio, and support tickets. Ask a question and I will keep the answer grounded in how the product works.",
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
  const [draft, setDraft] = useState("How do vaults, margin, and prediction markets work together?");
  const [askStatus, setAskStatus] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("Support request");
  const [summary, setSummary] = useState("");
  const [ticketStatus, setTicketStatus] = useState("");

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
          context: "Support tab chat. User: " + handle + (wallet ? ". Wallet: " + wallet : ". No wallet connected."),
          conversation: messages.map((message) => ({ role: message.role, content: message.content })),
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
            content: "I could not answer that right now. You can still create a ticket and the team will receive the transcript through Telegram once alerts are configured.",
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
      setAskStatus(body.data.mode === "ai" ? "Answered by Conviction AI." : "Answered with built-in Conviction context.");
      if (!summary.trim()) setSummary(question + "\n\n" + body.data.answer);
    } catch {
      setAskStatus("Support AI is unavailable right now.");
      setMessages([
        ...nextMessages,
        {
          id: "assistant-network-" + Date.now(),
          role: "assistant",
          content: "The support assistant is unavailable right now. Create a ticket with your email and issue summary so the team can follow up.",
          mode: "fallback",
        },
      ]);
    }
  }

  async function createTicket() {
    const cleanEmail = email.trim();
    const cleanSummary = summary.trim() || latestUserMessage(messages) || "Support chat escalation requested.";
    const cleanSubject = subject.trim() || "Support request";

    if (!cleanEmail || !cleanSummary) {
      setTicketStatus("Email and issue summary are required.");
      return;
    }

    setTicketStatus("Creating Telegram support ticket...");

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

      setTicketStatus(
        body.data.ticket.telegramSentAt
          ? "Ticket created and sent to Telegram."
          : "Ticket created. Add Telegram env vars in Vercel to enable team alerts.",
      );
    } catch {
      setTicketStatus("Ticket could not be created right now.");
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
      <main className="terminal-page px-4 py-6 sm:px-6 lg:px-10">
        <section className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-[#262626] bg-[#111111] p-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Support</p>
              <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">Conviction help desk</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#ccc3d8]">
                Chat with Conviction AI about markets, vaults, margin, wallet sessions, Activity, or portfolio. If it needs a human, send the transcript to the team through Telegram support alerts.
              </p>
            </div>
            <div className="rounded border border-[#262626] bg-[#0A0A0A] px-4 py-3 text-right">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#ccc3d8]/60">Signed in as</p>
              <p className="mt-1 font-mono text-xs font-bold text-white">{handle}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <section className="rounded-lg border border-[#262626] bg-surface-card p-4 sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-deep-orange/35 bg-deep-orange/10 text-deep-orange">
                  <Bot size={18} />
                </span>
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">AI support chat</p>
                  <h2 className="mt-1 text-xl font-bold text-white">Ask, follow up, then escalate if needed</h2>
                  <p className="mt-1 text-sm text-[#ccc3d8]">The assistant carries the thread context and keeps answers grounded in Conviction product behavior.</p>
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto rounded-lg border border-[#262626] bg-[#0A0A0A] p-3">
                <div className="grid gap-3">
                  {messages.map((message) => (
                    <article
                      className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      key={message.id}
                    >
                      {message.role === "assistant" ? (
                        <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-deep-orange/30 bg-deep-orange/10 text-deep-orange">
                          <Bot size={14} />
                        </span>
                      ) : null}
                      <div
                        className={`max-w-[82%] rounded-lg border p-3 text-sm leading-relaxed ${
                          message.role === "user"
                            ? "border-deep-orange/45 bg-deep-orange text-black"
                            : "border-[#262626] bg-[#111111] text-white"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {message.role === "assistant" && message.mode ? (
                          <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-[#ccc3d8]/50">
                            {message.mode === "ai" ? "Conviction AI" : "Built-in context"}
                          </p>
                        ) : null}
                      </div>
                      {message.role === "user" ? (
                        <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#262626] bg-[#111111] text-[#ccc3d8]">
                          <UserRound size={14} />
                        </span>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {quickQuestions.map((question) => (
                  <button
                    className="rounded border border-[#262626] bg-[#0A0A0A] px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8] hover:border-deep-orange hover:text-white"
                    key={question}
                    onClick={() => void submitChat(undefined, question)}
                    type="button"
                  >
                    {question}
                  </button>
                ))}
              </div>

              <form className="mt-3 grid gap-3" onSubmit={(event) => void submitChat(event)}>
                <textarea
                  className="min-h-28 w-full resize-y rounded border border-[#262626] bg-[#0A0A0A] p-3 text-sm leading-relaxed text-white outline-none focus:border-deep-orange"
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask a follow-up..."
                  value={draft}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded bg-deep-orange px-4 font-mono text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white"
                    type="submit"
                  >
                    <Sparkles size={14} />
                    Send message
                  </button>
                  {askStatus ? <p className="font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8]/65">{askStatus}</p> : null}
                </div>
              </form>
            </section>

            <aside className="rounded-lg border border-[#262626] bg-surface-card p-4 sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-[#262626] bg-[#0A0A0A] text-deep-orange">
                  <LifeBuoy size={18} />
                </span>
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Human support</p>
                  <h2 className="mt-1 text-xl font-bold text-white">Escalate the chat</h2>
                  <p className="mt-1 text-sm text-[#ccc3d8]">Tickets are stored in core and include the support transcript for Telegram alerts.</p>
                </div>
              </div>

              <div className="grid gap-3">
                <label className="grid gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8]/70">
                  Email
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#ccc3d8]/45" size={14} />
                    <input
                      className="min-h-11 w-full rounded border border-[#262626] bg-[#0A0A0A] pl-9 pr-3 text-xs text-white outline-none focus:border-deep-orange"
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      value={email}
                    />
                  </div>
                </label>
                <label className="grid gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8]/70">
                  Subject
                  <input
                    className="min-h-11 rounded border border-[#262626] bg-[#0A0A0A] px-3 text-xs text-white outline-none focus:border-deep-orange"
                    onChange={(event) => setSubject(event.target.value)}
                    value={subject}
                  />
                </label>
                <label className="grid gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ccc3d8]/70">
                  Issue summary
                  <textarea
                    className="min-h-32 resize-y rounded border border-[#262626] bg-[#0A0A0A] p-3 text-xs leading-relaxed text-white outline-none focus:border-deep-orange"
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="What needs human intervention?"
                    value={summary}
                  />
                </label>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-deep-orange px-4 font-mono text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white"
                  onClick={() => void createTicket()}
                  type="button"
                >
                  <Send size={14} />
                  Send ticket
                </button>
                {ticketStatus ? <p className="font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8]/65">{ticketStatus}</p> : null}
              </div>
            </aside>
          </div>

          <section className="mt-4 grid gap-3 md:grid-cols-3">
            {supportCards.map((card) => {
              const Icon = card.icon;
              return (
                <article className="rounded-lg border border-[#262626] bg-[#111111] p-4" key={card.title}>
                  <Icon className="text-deep-orange" size={18} />
                  <h3 className="mt-3 text-sm font-bold text-white">{card.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#ccc3d8]">{card.body}</p>
                </article>
              );
            })}
          </section>
        </section>
      </main>
    </TerminalShell>
  );
}

const supportCards = [
  {
    title: "Telegram only",
    body: "Human escalation is routed to the team through Telegram alerts. No WhatsApp flow is used.",
    icon: Send,
  },
  {
    title: "Wallet context",
    body: "When connected, tickets include the active wallet and user id so support can trace account-specific issues.",
    icon: ShieldCheck,
  },
  {
    title: "Product context",
    body: "The assistant is scoped to Conviction markets, margin, vaults, portfolio, social activity, and profiles.",
    icon: Bot,
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
