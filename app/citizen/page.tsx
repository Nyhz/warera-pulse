import { AppShell } from "@/components/dashboard/AppShell";
import { CitizenDashboard } from "@/components/citizen/CitizenDashboard";

export const metadata = {
  title: "Citizen Dashboard · WarEra Pulse",
  description: "Per-citizen economic dashboard: net worth, companies, production and estimated daily income.",
};

export default function CitizenPage() {
  return (
    <AppShell>
      <CitizenDashboard />
    </AppShell>
  );
}
