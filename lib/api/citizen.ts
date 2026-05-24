import { useQuery } from "@tanstack/react-query";

export type CitizenWealth = {
  companies: number;
  items: number;
  money: number;
  equipments: number;
  weapons: number;
  total: number;
};
export type CitizenCompany = {
  id: string;
  name: string;
  itemCode: string;
  production: number;
  levels: { automatedEngine: number; storage: number; breakRoom: number };
  workerCount: number;
  wageTotal: number;
  estimatedValue: number;
  regionId: string | null;
  disabled: boolean;
};
export type CitizenSkills = {
  companies: number;
  production: number;
  entrepreneurship: number;
  management: number;
  energy: number;
};
export type Citizen = {
  user: {
    id: string;
    username: string;
    level: number;
    isPremium: boolean;
    premiumMonths: number;
    militaryRank: number;
    countryId: string | null;
    avatarUrl: string | null;
    worksCount: number;
    skills: CitizenSkills;
    wealth: CitizenWealth;
    estimatedWealth: number;
    wealthRank: { rank: number; tier: string | null };
    damageRank: { rank: number; tier: string | null };
  };
  companies: CitizenCompany[];
};

/** Per-citizen economic snapshot (identity, net worth, owned companies). */
export function useCitizen(userId?: string) {
  return useQuery({
    queryKey: ["citizen", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Citizen> => {
      const res = await fetch(`/api/user/${userId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Failed to load ${userId}`);
      return json as Citizen;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
