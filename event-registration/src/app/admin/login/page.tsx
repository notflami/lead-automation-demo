import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Embroidery } from "@/components/Embroidery";
import { LoginForm } from "@/components/admin/LoginForm";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Organizer sign-in", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="flex min-h-dvh flex-col bg-ink text-linen">
      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <h1 className="display text-4xl">Organizer sign-in</h1>
          <p className="mt-3 text-linen/75">Registrations and event settings.</p>
          <LoginForm />
        </div>
      </div>
      <Embroidery cell={4} className="bg-linen py-3" />
    </main>
  );
}
