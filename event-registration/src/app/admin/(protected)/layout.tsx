import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const s = await getSettings();
  return (
    <div className="min-h-dvh bg-[#f3f2ee] text-base">
      <header className="bg-ink text-linen">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/admin" className="display mr-auto text-2xl">
            {s.event_name}
          </Link>
          <Link href="/" target="_blank" className="text-sm text-linen/75 underline-offset-4 hover:underline">
            View public page
          </Link>
          <form action={logoutAction}>
            <button className="min-h-10 rounded-full border border-linen/30 px-4 text-sm hover:border-linen">Sign out</button>
          </form>
        </div>
        <AdminNav />
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
