import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roast My Code",
  description: "AI-powered code roasting with multiple personality judges",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
          {children}
        </main>
      </body>
    </html>
  );
}

function Sidebar() {
  return (
    <aside
      className="flex flex-col shrink-0 h-full overflow-y-auto"
      style={{ width: 240, background: "var(--sidebar)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div
          className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: "rgba(255,107,53,0.15)", border: "1px solid rgba(255,107,53,0.3)" }}
        >
          <span style={{ fontSize: 18 }}>🔥</span>
        </div>
        <div>
          <div className="font-bold text-white leading-tight" style={{ fontSize: 15 }}>Roast My</div>
          <div className="font-bold leading-tight" style={{ fontSize: 15, color: "var(--fire)" }}>Code</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 16px" }} />

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        <NavLink href="/" label="Home" icon="✦" />
        <NavLink href="/history" label="History" icon="📋" />
        <NavLink href="/settings" label="Settings" icon="⚙️" />
      </nav>

    </aside>
  );
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
      style={{
        color: "rgba(255,255,255,0.65)",
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
