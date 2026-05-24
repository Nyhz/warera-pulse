import type { NextRequest } from "next/server";

/**
 * Per-citizen economic snapshot for the Citizen dashboard.
 *
 * One id resolves to three gateway reads, trimmed to what the dashboard needs:
 *   1. user.getUserById         → identity + stats.wealth (net worth breakdown)
 *   2. company.getCompanies     → the ids of the companies this user OWNS
 *      (the user's own `company` field is their WORKPLACE, not ownership)
 *   3. company.getById (batched)→ each owned company's production/levels/value
 *
 * All data is public-by-id and read through the shared server key, so it is
 * cached per-userId via Next's Data Cache (the id is in the URL). Prices are
 * intentionally NOT included — the client derives money/day from the live 10s
 * snapshot so it stays current without re-fetching this route.
 */
const GATEWAY = "https://gateway.warerastats.io/trpc";
const API2 = "https://api2.warera.io/trpc";
const KEY = process.env.WARERA_API_KEY?.trim() || undefined;
const BASE = process.env.WARERA_API_BASE?.trim() || (KEY ? GATEWAY : API2);

/** User/company data is per-citizen; refresh window kept modest. */
const REVALIDATE = 60;

function headers(base: string): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": "WarEraPulse/0.1" };
  if (KEY && base !== API2) h["X-API-Key"] = KEY;
  return h;
}

async function query<T>(proc: string, input: unknown): Promise<T | null> {
  const url = `${BASE}/${proc}?input=${encodeURIComponent(JSON.stringify(input))}`;
  const res = await fetch(url, { headers: headers(BASE), next: { revalidate: REVALIDATE } });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: { data?: T } };
  return json.result?.data ?? null;
}

/** Fetch many companies by id in ONE same-proc tRPC batch (fast). */
async function fetchCompanies(ids: string[]): Promise<RawCompany[]> {
  if (ids.length === 0) return [];
  const path = ids.map(() => "company.getById").join(",");
  const input = JSON.stringify(Object.fromEntries(ids.map((id, i) => [i, { companyId: id }])));
  const url = `${BASE}/${path}?batch=1&input=${encodeURIComponent(input)}`;
  const res = await fetch(url, { headers: headers(BASE), next: { revalidate: REVALIDATE } });
  if (!res.ok) return [];
  const arr = (await res.json()) as { result?: { data?: RawCompany }; error?: unknown }[];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((e) => (e && !e.error ? (e.result?.data ?? null) : null))
    .filter((c): c is RawCompany => !!c);
}

// --- Raw upstream shapes (only the fields we read) ---
type RawWealth = {
  companies?: number;
  items?: number;
  money?: number;
  equipments?: number;
  weapons?: number;
  total?: number;
};
type RawRank = { rank?: number; tier?: string; value?: number };
type RawSkill = { level?: number };
type RawUser = {
  _id?: string;
  username?: string;
  country?: string;
  militaryRank?: number;
  avatarUrl?: string;
  leveling?: { level?: number };
  infos?: { isPremium?: boolean; premiumMonthsCount?: number };
  skills?: {
    companies?: RawSkill;
    production?: RawSkill;
    management?: RawSkill;
    entrepreneurship?: RawSkill;
    energy?: RawSkill;
  };
  stats?: { worksCount?: number; estimatedWealth?: number; wealth?: RawWealth };
  rankings?: { userWealth?: RawRank; userDamages?: RawRank };
};
type RawCompany = {
  _id?: string;
  name?: string;
  itemCode?: string;
  production?: number;
  workerCount?: number;
  workers?: { wage?: number }[];
  estimatedValue?: number;
  region?: string;
  disabledAt?: string;
  activeUpgradeLevels?: { automatedEngine?: number; storage?: number; breakRoom?: number };
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return Response.json({ error: "Invalid user id" }, { status: 400 });
  }

  // Identity and the owned-company id list both depend only on the id, so fetch
  // them in parallel; the per-company batch needs the list, so it follows.
  const [user, list] = await Promise.all([
    query<RawUser>("user.getUserById", { userId: id }),
    query<{ items?: string[] }>("company.getCompanies", { userId: id }),
  ]);
  if (!user || !user._id) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const ids = Array.isArray(list?.items) ? list.items : [];
  const companies = await fetchCompanies(ids);

  const w = user.stats?.wealth ?? {};
  const payload = {
    user: {
      id: user._id,
      username: user.username ?? "Unknown",
      level: num(user.leveling?.level),
      isPremium: !!user.infos?.isPremium,
      premiumMonths: num(user.infos?.premiumMonthsCount),
      militaryRank: num(user.militaryRank),
      countryId: user.country ?? null,
      avatarUrl: user.avatarUrl ?? null,
      worksCount: num(user.stats?.worksCount),
      skills: {
        companies: num(user.skills?.companies?.level),
        production: num(user.skills?.production?.level),
        entrepreneurship: num(user.skills?.entrepreneurship?.level),
        management: num(user.skills?.management?.level),
        energy: num(user.skills?.energy?.level),
      },
      wealth: {
        companies: num(w.companies),
        items: num(w.items),
        money: num(w.money),
        equipments: num(w.equipments),
        weapons: num(w.weapons),
        total: num(w.total),
      },
      estimatedWealth: num(user.stats?.estimatedWealth),
      wealthRank: {
        rank: num(user.rankings?.userWealth?.rank),
        tier: user.rankings?.userWealth?.tier ?? null,
      },
      damageRank: {
        rank: num(user.rankings?.userDamages?.rank),
        tier: user.rankings?.userDamages?.tier ?? null,
      },
    },
    companies: companies.map((c) => ({
      id: c._id ?? "",
      name: c.name ?? "—",
      itemCode: c.itemCode ?? "",
      production: num(c.production),
      levels: {
        automatedEngine: num(c.activeUpgradeLevels?.automatedEngine),
        storage: num(c.activeUpgradeLevels?.storage),
        breakRoom: num(c.activeUpgradeLevels?.breakRoom),
      },
      workerCount: num(c.workerCount),
      // `workers` can retain stale roster entries after a worker leaves, while
      // `workerCount` is the authoritative active count — only bill wages when
      // there are active workers so net income isn't dinged by phantom wages.
      wageTotal:
        num(c.workerCount) > 0 && Array.isArray(c.workers)
          ? c.workers.reduce((s, w) => s + num(w.wage), 0)
          : 0,
      estimatedValue: num(c.estimatedValue),
      regionId: c.region ?? null,
      disabled: !!c.disabledAt,
    })),
  };

  return Response.json(payload, {
    headers: {
      "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
    },
  });
}
