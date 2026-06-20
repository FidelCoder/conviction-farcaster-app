"use client";

import { Bot, LifeBuoy, Mail, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TerminalShell } from "../../components/TerminalShell";
import { getSessionWalletAddress, getStoredBrowserWalletSession } from "../../lib/browser-wallet-session";
import {
  getExecutionCapabilities,
  listMarkets,
  type ExecutionCapabilities,
  type UserSession,
} from "../../lib/core-api";

type SupportAiResponse =
  | { ok: true; data: { answer: string; mode: "ai" | "fallback" } }
  | { ok: false; error: { message: string } };

type SupportTicketResponse =
  | { ok: true; data: { ticket: { id: string; status: string; telegramSentAt: string | null } } }
  | { ok: false; error: { message: string } };

export default function SupportPage() {
  const [terminalData, setTerminalData] = useState<{
    execution: ExecutionCapabilities;
    marketCount: number;
  } | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [question, setQuestion] = useState("How do vaults, margin, and prediction markets work together?");
  const [answer, setAnswer] = useState("");
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

  async function askAssistant() {
    const trimmed = question.trim();
    if (!trimmed) {
      setAskStatus("Ask a question first.");
      return;
    }

    setAskStatus("Thinking...");
    setAnswer("");

    try {
      const response = await fetch("/api/support/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, context: "Support tab" }),
      });
      const body = (await response.json()) as SupportAiResponse;

      if (!response.ok || !body.ok) {
        setAskStatus(body.ok ? "Support AI unavailable." : body.error.message);
        return;
      }

      setAnswer(body.data.answer);
      setAskStatus(body.data.mode === "ai" ? "Answered by Conviction AI." : "Answered with local support context.");
      if (!summary.trim()) setSummary(trimmed + "\n\n" + body.data.answer);
    } catch {
      setAskStatus("Support AI is unavailable right now.");
    }
  }

  async function createTicket() {
    const cleanEmail = email.trim();
    const cleanSummary = summary.trim();
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
          transcript: answer ? "Q: " + question.trim() + "\nA: " + answer : null,
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
                Ask about markets, vaults, margin, profiles, wallet sessions, Activity, or portfolio. If it needs a human, create a ticket and the team receives it through Telegram.
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
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">AI assistant</p>
                  <h2 className="mt-1 text-xl font-bold text-white">Ask before opening a ticket</h2>
                  <p className="mt-1 text-sm text-[#ccc3d8]">Answers use Conviction product context and fall back safely if the AI provider is not configured.</p>
                </div>
              </div>

              <textarea
                className="min-h-36 w-full resize-y rounded border border-[#262626] bg-[#0A0A0A] p-3 text-sm leading-relaxed text-white outline-none focus:border-deep-orange"
                onChange={(event) => setQuestion(event.target.value)}
                value={question}
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded bg-deep-orange px-4 font-mono text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white"
                  onClick={() => void askAssistant()}
                  type="button"
                >
                  <Sparkles size={14} />
                  Ask support AI
                </button>
                {askStatus ? <p className="font-mono text-[10px] uppercase tracking-widest text-[#ccc3d8]/65">{askStatus}</p> : null}
              </div>

              {answer ? (
                <article className="mt-4 rounded border border-[#262626] bg-[#0A0A0A] p-4">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Answer</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white">{answer}</p>
                </article>
              ) : null}
            </section>

            <aside className="rounded-lg border border-[#262626] bg-surface-card p-4 sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-[#262626] bg-[#0A0A0A] text-deep-orange">
                  <LifeBuoy size={18} />
                </span>
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-deep-orange">Human support</p>
                  <h2 className="mt-1 text-xl font-bold text-white">Create a ticket</h2>
                  <p className="mt-1 text-sm text-[#ccc3d8]">Tickets are stored in core and can alert Telegram when the bot is configured.</p>
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
                    placeholder="What happened, which page, wallet, tx hash, or market if relevant?"
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

function shortWallet(wallet: string) {
  return wallet.slice(0, 6) + "..." + wallet.slice(-4);
}
