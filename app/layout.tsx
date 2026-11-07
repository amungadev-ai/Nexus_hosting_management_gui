import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "NexusPanel",
    template: "%s — NexusPanel",
  },
  description:
    "NexusPanel GUI prototype — a static, server-free prototype of the hosting control panel defined by the Stage 1–7 v2.0 specifications. All data is mocked against the Stage 6 API contract.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/** No-FOUC theme bootstrap: runs before paint (light/dark/system + density). */
const themeBootstrap = `(function(){try{var t=JSON.parse(localStorage.getItem("nx.theme")||'"light"');var d=JSON.parse(localStorage.getItem("nx.density")||'"comfortable"');var dark=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark)document.documentElement.classList.add("dark");if(d==="compact")document.documentElement.classList.add("density-compact");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
