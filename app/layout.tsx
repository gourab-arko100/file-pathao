import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "File Pathao",
  description: "Send files between your PC and phone — no cables, no Bluetooth.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
