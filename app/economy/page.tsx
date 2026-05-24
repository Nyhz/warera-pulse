import { AppShell } from "@/components/dashboard/AppShell";
import { EconomyView } from "@/components/economy/EconomyView";

export const metadata = {
  title: "Economy · WarEra Pulse",
  description: "Refining margins and a nations economy table: production bonuses, taxes and development.",
};

export default function EconomyPage() {
  return (
    <AppShell fill>
      <EconomyView />
    </AppShell>
  );
}
