"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV === "development"}
      cacheOnNavigation={false}
      reloadOnOnline={false}
    >
      {children}
      <Toaster position="top-center" offset={{ top: 80 }} mobileOffset={{ top: 76, left: 16, right: 16 }} duration={3000} closeButton />
    </SerwistProvider>
  );
}
