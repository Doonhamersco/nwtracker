import { notFound } from "next/navigation";
import { SpendingClient } from "@/components/spending/SpendingClient";
import { PreviewFrame } from "@/app/preview/PreviewFrame";
import { previewSpendingReport } from "@/lib/spending/preview";

export const dynamic = "force-dynamic";

export default async function SpendingPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const raw = Array.isArray(params.month) ? params.month[0] : params.month;
  const month = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : null;

  return (
    <PreviewFrame note="Sample data for layout review. The live Spending page reads imported statements.">
      <SpendingClient report={previewSpendingReport(month)} basePath="/preview/spending" />
    </PreviewFrame>
  );
}
