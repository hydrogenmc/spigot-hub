import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Trophy, Coins } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Particles } from "@/components/Particles";
import { getLeaderboard } from "@/lib/credits.functions";

const lbQuery = queryOptions({
  queryKey: ["leaderboard"],
  queryFn: () => getLeaderboard(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [
    { title: "Credits Leaderboard — Cubyn Spigot" },
    { name: "description", content: "Top members ranked by Cubyn Credits earned from activity and bonuses." },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(lbQuery),
  component: LeaderboardPage,
  errorComponent: ({ error }) => <Center><p className="text-destructive">{error.message}</p></Center>,
  notFoundComponent: () => <Center><p>Not found</p></Center>,
});

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center">{children}</div>;
}

function LeaderboardPage() {
  const { data } = useQuery(lbQuery);
  const rows = data ?? [];

  return (
    <div className="relative min-h-screen">
      <Particles count={20} />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Trophy size={36} className="mx-auto text-primary" />
          <h1 className="mt-4 font-display text-3xl font-bold">Credits <span className="text-gradient">Leaderboard</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">Top 50 members by total Cubyn Credits.</p>
        </div>

        <div className="glass-strong mt-8 overflow-hidden rounded-2xl">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No data yet.</div>
          ) : (
            <ul className="divide-y divide-border/40">
              {rows.map((u, i) => (
                <li key={u.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-primary/20 text-primary" : i < 3 ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <span className="font-medium text-foreground">{u.display_name ?? "Anonymous"}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    <Coins size={14} /> {u.credits_balance}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
