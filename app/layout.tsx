import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dream Car Show | Lions Club",
  description: "Lions Club Dream Car Show in Zionsville, Indiana.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
