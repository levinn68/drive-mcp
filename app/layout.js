import "./globals.css";
import "./compact-grid.css";
import OAuthReturnBanner from "../components/oauth-return-banner";

export const metadata = {
  title: "DRIVE | One Hub. Every Connection.",
  description: "Universal MCP & Agent Skills Hub — connect 13,000+ MCP servers and Agent Skills from one Liquid Glass workspace.",
  icons: {
    icon: "/drive-logo.svg",
    apple: "/drive-logo.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#08080a" />
      </head>
      <body>
        <OAuthReturnBanner />
        {children}
      </body>
    </html>
  );
}
