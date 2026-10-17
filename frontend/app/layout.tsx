import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanban | Project board",
  description: "A clear place to move work forward.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
