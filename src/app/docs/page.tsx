"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { TerminalShell } from "../../components/TerminalShell";
import type { ExecutionCapabilities } from "../../lib/core-api";

export default function DocsPage() {
  return (
    <TerminalShell activeTab="docs" execution={fallbackExecution} marketCount={0}>
      <main className="terminal-page terminal-docs-page docs-shell">
        <section className="terminal-page-heading">
          <div>
            <p>Docs</p>
            <h1>Conviction Markets</h1>
            <span>
              A prediction market discovery and margin layer. Browse real event markets,
              review the rules, request margin, and build your reputation onchain.
            </span>
          </div>
          <div className="settings-status-pill">Protocol guide</div>
        </section>

        <nav className="docs-toc" aria-label="Table of contents">
          <h2>Contents</h2>
          <ol>
            <li>
              <a href="#culture">The .viction Community</a>
            </li>
            <li>
              <a href="#overview">Platform Overview</a>
            </li>
            <li>
              <a href="#margin">Margin Leverage</a>
            </li>
            <li>
              <a href="#signals">Trade Signals</a>
            </li>
            <li>
              <a href="#copy">Copy Trading</a>
            </li>
            <li>
              <a href="#vaults">Vault System</a>
            </li>
            <li>
              <a href="#wallet">Wallet Flow</a>
            </li>
            <li>
              <a href="#profile">Profile & Identity</a>
            </li>
            <li>
              <a href="#glossary">Glossary</a>
            </li>
          </ol>
        </nav>

        <DocsSection id="culture" title="The .viction Community">
          <p>
            Every trader on Conviction Markets has a handle ending in <strong>.viction</strong> —
            like <code>alex.viction</code>, <code>sarah.viction</code>, or{" "}
            <code>griffins.viction</code>. It&apos;s our family name. A badge of belonging.
          </p>
          <p>
            The <code>.viction</code> suffix comes from <strong>conviction</strong> — the principle
            that the best trades come from deeply held beliefs backed by real analysis. When you see
            a <code>.viction</code> handle, you know you&apos;re looking at a member of a community
            that values thesis-driven trading over noise.
          </p>
          <div className="docs-callout">
            <strong>Pro tip:</strong> Set your handle to something memorable. Your{" "}
            <code>.viction</code> identity is your reputation on the platform.
          </div>
        </DocsSection>

        <DocsSection id="overview" title="Platform Overview">
          <p>
            Conviction Markets connects traders to prediction market data through a margin desk. The
            platform is built around three core concepts:
          </p>
          <ul>
            <li>
              <strong>Signals</strong> — Public trade theses that express your conviction in a
              market outcome. Signals are separate from execution; they&apos;re ideas, not orders.
            </li>
            <li>
              <strong>Margin Intents</strong> — Leveraged position requests that borrow capital from
              vaults to amplify exposure. Intents are recorded onchain through a three-step wallet
              flow.
            </li>
            <li>
              <strong>Copy Trading</strong> — Follow a trader&apos;s position by submitting a copy
              intent. Your copy mirrors their market, side, and size.
            </li>
          </ul>
          <p>
            All data comes from the Conviction Core API — no fake markets, no simulated PnL, no
            placeholder records. If core isn&apos;t available, the app shows empty states rather
            than fabricated data.
          </p>
        </DocsSection>

        <DocsSection id="margin" title="Margin Leverage">
          <p>
            The margin desk follows a <strong>prime-broker model</strong> for prediction markets:
          </p>
          <ol>
            <li>
              <strong>Choose a market</strong> — Select from synced prediction markets (currently
              Polymarket data via the Gamma API).
            </li>
            <li>
              <strong>Set collateral</strong> — Deposit USDC or WETH as your margin.
            </li>
            <li>
              <strong>Select leverage</strong> — Multiply your exposure up to the platform maximum
              (configurable per chain).
            </li>
            <li>
              <strong>Submit intent</strong> — Record your margin position on the core API. This
              creates a <code>PENDING_EXECUTION</code> position intent.
            </li>
          </ol>
          <div className="docs-callout warn">
            <strong>Important:</strong> Margin execution requires deployed vault contracts, active
            execution adapters, and onchain liquidity. Until those are live, margin requests remain
            as intent records only.
          </div>
          <h3>How Leverage Works</h3>
          <p>
            When you enter a leveraged position, the vault borrows additional capital from the pool
            to increase your position size. For example:
          </p>
          <ul>
            <li>
              <strong>Collateral:</strong> 1,000 USDC
            </li>
            <li>
              <strong>Leverage:</strong> 5x
            </li>
            <li>
              <strong>Position size:</strong> 5,000 USDC (1,000 of your capital + 4,000 borrowed)
            </li>
            <li>
              <strong>Liquidation guard:</strong> If the position value drops to 82% of entry, the
              system triggers partial settlement to protect the vault.
            </li>
          </ul>
          <p>
            The liquidation guard is an automated protection mechanism. It does not mean you will
            always be protected at exactly 82% — actual liquidation depends on market conditions and
            adapter implementation.
          </p>
        </DocsSection>

        <DocsSection id="signals" title="Trade Signals">
          <p>
            A <strong>signal</strong> is a public trade thesis — your reasoned take on what a market
            will resolve to. Signals are the social layer of Conviction Markets:
          </p>
          <ul>
            <li>
              <strong>Side:</strong> YES or NO — your predicted outcome.
            </li>
            <li>
              <strong>Thesis:</strong> Your reasoning, up to 5,000 characters.
            </li>
            <li>
              <strong>Conviction level:</strong> 1–100 — how confident you are.
            </li>
            <li>
              <strong>Source:</strong> FARCASTER, TELEGRAM, or WEB.
            </li>
          </ul>
          <p>
            Signals are <em>not</em> trade executions. Creating a signal does not create a position,
            calculate PnL, or imply a fill. Signals are ideas that build your reputation as a
            trader.
          </p>
          <p>
            Other users can <strong>reply</strong>, <strong>react</strong> (like),
            <strong>bookmark</strong>, and <strong>copy</strong> your signals. The social feed
            displays all published signals in chronological order.
          </p>
        </DocsSection>

        <DocsSection id="copy" title="Copy Trading">
          <p>
            <strong>Copy trading</strong> lets you mirror another trader&apos;s position. When you
            submit a copy intent:
          </p>
          <ul>
            <li>You specify the source position and the quantity you want to copy.</li>
            <li>
              The intent is recorded as <code>PENDING_EXECUTION</code>.
            </li>
            <li>When execution adapters are live, the copy will be executed automatically.</li>
          </ul>
          <p>
            Copy intents are linked to the source trader&apos;s position. The leaderboard tracks how
            many copies a trader has received, giving signal to the community about whose thesis has
            the most conviction.
          </p>
        </DocsSection>

        <DocsSection id="vaults" title="Vault System">
          <p>
            Conviction Markets uses a <strong>collateral vault</strong> system deployed on testnet
            chains (Base Sepolia, Ethereum Sepolia, Arbitrum Sepolia). The vault is an ERC20-based
            contract that:
          </p>
          <ul>
            <li>
              <strong>Holds collateral</strong> — USDC deposited by users and pool LPs.
            </li>
            <li>
              <strong>Records margin intents</strong> — Locks collateral while a margin position is
              active.
            </li>
            <li>
              <strong>Supports authorized operators</strong> — Future execution adapters will
              interact with the vault for settlement.
            </li>
            <li>
              <strong>Supports pause controls</strong> — Owner can pause activity during upgrades or
              emergencies.
            </li>
          </ul>
          <p>
            The vault does <em>not</em> currently execute trades. It holds collateral and records
            intent state. Real execution requires adapter confirmation, venue connectivity, and
            onchain evidence.
          </p>
          <h3>Supported Chains</h3>
          <table className="docs-table">
            <thead>
              <tr>
                <th>Chain</th>
                <th>Vault Address</th>
                <th>Collateral</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Base Sepolia</td>
                <td>
                  <code>0xfeBCb5...494E3</code>
                </td>
                <td>USDC</td>
              </tr>
              <tr>
                <td>Ethereum Sepolia</td>
                <td>
                  <code>0xB1dA85...29f605</code>
                </td>
                <td>USDC</td>
              </tr>
              <tr>
                <td>Arbitrum Sepolia</td>
                <td>
                  <code>0xd53cec...A0858c</code>
                </td>
                <td>USDC</td>
              </tr>
            </tbody>
          </table>
        </DocsSection>

        <DocsSection id="wallet" title="Wallet Flow">
          <p>The vault transaction flow is a three-step wallet sequence:</p>
          <ol>
            <li>
              <strong>Approve USDC</strong> — Authorize the vault contract to spend your USDC
              collateral.
            </li>
            <li>
              <strong>Deposit Collateral</strong> — Transfer USDC into the vault.
            </li>
            <li>
              <strong>Create Margin Intent</strong> — Submit the onchain margin intent with your
              chosen leverage and slippage parameters.
            </li>
          </ol>
          <p>
            Each step uses <code>viem</code> to prepare the contract call and sends it through your
            connected browser wallet, such as MetaMask or Coinbase Wallet.
          </p>
          <div className="docs-callout">
            <strong>Note:</strong> Submitting vault transactions does not guarantee a market fill,
            executed position, or PnL. It only records the onchain intent.
          </div>
        </DocsSection>

        <DocsSection id="profile" title="Profile & Identity">
          <p>Your profile is how the community knows you. Every trader has:</p>
          <ul>
            <li>
              <strong>Handle</strong> — Your unique <code>.viction</code> identifier (e.g.,{" "}
              <code>alex.viction</code>).
            </li>
            <li>
              <strong>Avatar</strong> — Your profile picture. Pick a generated Web3 avatar card,
              upload your own image, or set a custom image URL.
            </li>
            <li>
              <strong>Bio</strong> — A short description of who you are and what you trade.
            </li>
            <li>
              <strong>Email</strong> — Optional. Used for notifications about your positions and
              platform updates.
            </li>
          </ul>
          <p>
            Visit <Link href="/me/profile">your profile</Link> to customize your identity. Your
            handle, avatar, and bio appear on every signal and post you publish.
          </p>
        </DocsSection>

        <DocsSection id="glossary" title="Glossary">
          <dl className="docs-glossary">
            <div>
              <dt>Collateral</dt>
              <dd>The USDC or WETH you deposit as security for a leveraged position.</dd>
            </div>
            <div>
              <dt>Conviction</dt>
              <dd>A measure (1–100) of how confident you are in your market thesis.</dd>
            </div>
            <div>
              <dt>Copy Intent</dt>
              <dd>A request to mirror another trader&apos;s position, pending execution.</dd>
            </div>
            <div>
              <dt>Execution Adapter</dt>
              <dd>A smart contract or service that executes trades on a venue.</dd>
            </div>
            <div>
              <dt>Intent</dt>
              <dd>A recorded request that has not been executed yet.</dd>
            </div>
            <div>
              <dt>Leverage</dt>
              <dd>A multiplier that amplifies your position size using borrowed capital.</dd>
            </div>
            <div>
              <dt>Liquidation Guard</dt>
              <dd>An automatic safety mechanism that closes a position to protect the vault.</dd>
            </div>
            <div>
              <dt>Margin Desk</dt>
              <dd>The trading interface where you submit leveraged position intents.</dd>
            </div>
            <div>
              <dt>Signal</dt>
              <dd>A public trade thesis — your reasoned prediction about a market outcome.</dd>
            </div>
            <div>
              <dt>.viction</dt>
              <dd>The community suffix for all trader handles. A badge of belonging.</dd>
            </div>
          </dl>
        </DocsSection>
      </main>
    </TerminalShell>
  );
}

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

function DocsSection({ children, id, title }: { children: ReactNode; id: string; title: string }) {
  return (
    <section className="docs-section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
