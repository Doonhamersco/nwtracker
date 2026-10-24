import AppShell from "@/components/layout/AppShell";
import { ProfileProvider } from "@/components/layout/ProfileProvider";
import { DEFAULT_ACCENT_COLOR } from "@/lib/profile-theme";

/** Dev-only chrome so layout previews show the real sidebar. */
export function PreviewFrame({
  note,
  children,
}: {
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full">
      <ProfileProvider initialAccentColor={DEFAULT_ACCENT_COLOR} hasAvatar={false} updatedAt={null}>
        <AppShell>
          <div className="mx-auto max-w-6xl space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">{note}</p>
            {children}
          </div>
        </AppShell>
      </ProfileProvider>
    </div>
  );
}
