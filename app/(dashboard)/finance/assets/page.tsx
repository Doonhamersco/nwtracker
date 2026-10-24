import { AssetsClient } from "@/components/assets/AssetsClient"
import { listPhysicalAssets, totalPhysicalAssetsGbp } from "@/lib/services/physical-assets"

export const metadata = {
  title: "Assets — nwTracker",
}

export default function PhysicalAssetsPage() {
  const assets = listPhysicalAssets().map((asset) => ({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    valueGbp: asset.valueGbp,
    purchaseDate: asset.purchaseDate,
    purchasePriceGbp: asset.purchasePriceGbp,
    notes: asset.notes,
  }))

  return <AssetsClient initialAssets={assets} initialTotal={totalPhysicalAssetsGbp()} />
}
