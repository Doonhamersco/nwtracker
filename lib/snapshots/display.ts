import {
  displayedSnapshotWorth,
  withCurrentPhysicalAssets,
  type SnapshotWorth,
} from "@/lib/engine/net-worth";

export type SnapshotAccountType = "ASSET" | "LIABILITY";

export interface SnapshotAccountLine {
  id: string;
  name: string;
  category: string;
  type: SnapshotAccountType;
  /** Signed pounds shown on the snapshot page. Liabilities are negative in total mode. */
  signedGbp: number;
  carriedForward: boolean;
  netDepositGbp: number | null;
}

export interface SnapshotPresentation {
  hideDebt: boolean;
  hideAssets: boolean;
  label: "Liquid net worth" | "Net worth";
  totalGbp: number | null;
  lines: SnapshotAccountLine[];
}

export function snapshotHref(id: string, hideDebt: boolean, hideAssets: boolean): string {
  const params = new URLSearchParams();
  params.set("mode", hideDebt ? "liquid" : "total");
  if (hideAssets) params.set("assets", "hidden");
  return `/snapshots/${id}?${params.toString()}`;
}

export function snapshotViewFromQuery(query: {
  mode?: string | string[];
  assets?: string | string[];
}): { hideDebt: boolean | null; hideAssets: boolean | null } {
  const mode = Array.isArray(query.mode) ? query.mode[0] : query.mode;
  const assets = Array.isArray(query.assets) ? query.assets[0] : query.assets;
  return {
    hideDebt: mode === "liquid" ? true : mode === "total" ? false : null,
    hideAssets: assets === "hidden" ? true : assets === "shown" ? false : null,
  };
}

/**
 * Headline and account lines for one snapshot, using the same worth as the
 * overview chart point. Liquid mode lists assets only. Total mode subtracts
 * liabilities and shows them as negative.
 */
export function presentSnapshot(input: {
  snapshot: SnapshotWorth;
  accounts: Array<{
    id: string;
    name: string;
    category: string;
    type: SnapshotAccountType;
    valueGbp: number;
    carriedForward?: boolean;
    netDepositGbp?: number | null;
  }>;
  isLatestCommitted: boolean;
  currentPhysicalAssetsGbp: number;
  hideDebt: boolean;
  hideAssets: boolean;
}): SnapshotPresentation {
  const prepared = input.isLatestCommitted
    ? (withCurrentPhysicalAssets([input.snapshot], input.currentPhysicalAssetsGbp)[0] ?? input.snapshot)
    : input.snapshot;
  const debtGbp = input.accounts
    .filter((account) => account.type === "LIABILITY")
    .reduce((sum, account) => sum + account.valueGbp, 0);
  const totalGbp = displayedSnapshotWorth(prepared, {
    hideDebt: input.hideDebt,
    hideAssets: input.hideAssets,
    debtGbp,
    latestCommittedId: input.isLatestCommitted ? input.snapshot.id : null,
    currentPhysicalAssetsGbp: input.currentPhysicalAssetsGbp,
  });
  const physicalShown =
    input.hideAssets || totalGbp === null
      ? 0
      : input.isLatestCommitted
        ? input.currentPhysicalAssetsGbp
        : (input.snapshot.physicalAssetsGbp ?? 0);

  const accountLines = input.accounts
    .filter((account) => (input.hideDebt ? account.type !== "LIABILITY" : true))
    .map((account) => ({
      id: account.id,
      name: account.name,
      category: account.category,
      type: account.type,
      signedGbp: account.type === "LIABILITY" ? -account.valueGbp : account.valueGbp,
      carriedForward: account.carriedForward ?? false,
      netDepositGbp: account.netDepositGbp ?? null,
    }))
    .sort((a, b) => Math.abs(b.signedGbp) - Math.abs(a.signedGbp));

  const lines =
    physicalShown !== 0
      ? [
          ...accountLines,
          {
            id: "physical-assets",
            name: "Physical assets",
            category: "Physical",
            type: "ASSET" as const,
            signedGbp: physicalShown,
            carriedForward: false,
            netDepositGbp: null,
          },
        ]
      : accountLines;

  return {
    hideDebt: input.hideDebt,
    hideAssets: input.hideAssets,
    label: input.hideDebt ? "Liquid net worth" : "Net worth",
    totalGbp,
    lines,
  };
}
