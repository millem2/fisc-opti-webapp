"use client";

import { HeroUIProvider } from "@heroui/react";
import { AuthProvider } from "@/lib/auth-context";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <HeroUIProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </HeroUIProvider>
  );
}
