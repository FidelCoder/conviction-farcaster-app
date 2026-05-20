import { EmptyState } from "../../../components/EmptyState";
import { SignalCard } from "../../../components/SignalCard";
import { getSignal } from "../../../lib/core-api";

export const dynamic = "force-dynamic";

type SignalPageProps = {
  params: Promise<{ signalId: string }>;
};

export default async function SignalPage({ params }: SignalPageProps) {
  const { signalId } = await params;
  const signal = await getSignal(signalId);

  return (
    <main className="page-shell">
      {signal ? (
        <SignalCard signal={signal} />
      ) : (
        <EmptyState
          title="Signal not found"
          body="The core API did not return a signal for this ID."
        />
      )}
    </main>
  );
}
