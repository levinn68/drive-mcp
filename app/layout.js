import "./globals.css";

export const metadata = {
  title: "DRIVE | One Hub. Every Connection.",
  description: "Discover, evaluate and manage MCP servers from one secure directory.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
