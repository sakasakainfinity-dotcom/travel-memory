"use client";
import AuthGate from "@/components/AuthGate";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <header style={{ padding: 12, display: "flex", justifyContent: "space-between" }}>
        <div>PhotoMapper</div>
      </header>
      {children}
    </AuthGate>
  );
}
