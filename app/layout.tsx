import type { ReactNode } from "react";

export const metadata = {
  title: "PMC CENTRE AI – Clean UI",
  description: "Clean non-streaming UI prototype for PMC CENTRE AI",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
