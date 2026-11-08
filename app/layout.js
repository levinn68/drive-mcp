import "./globals.css";

export const metadata = {
  title: "NEXORA | One Hub. Every Connection.",
  description: "A secure, unified hub for discovering and managing MCP integrations.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
