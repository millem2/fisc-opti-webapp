"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login" || pathname === "/";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F8F5] p-4">
      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-8">

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
            style={{ backgroundColor: "#1B3D2C" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <p className="font-bold text-[#1B3D2C] text-lg leading-none">Fiscopti</p>
          <p className="text-gray-400 text-xs mt-1">Simulateur fiscal intelligent</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <Link
            href="/login"
            className={`flex-1 py-2 text-sm font-medium text-center rounded-lg transition-all ${
              isLogin ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Connexion
          </Link>
          <Link
            href="/register"
            className={`flex-1 py-2 text-sm font-medium text-center rounded-lg transition-all ${
              !isLogin ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Inscription
          </Link>
        </div>

        {/* Form content */}
        {children}
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center gap-4 text-xs text-gray-400">
        <span>Mentions Légales</span>
        <span>·</span>
        <span>Confidentialité</span>
        <span>·</span>
        <span>© 2026 FiscOpti</span>
      </div>
    </div>
  );
}
