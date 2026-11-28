import "./globals.css";
import "./compact-grid.css";
import OAuthReturnBanner from "../components/oauth-return-banner";

export const metadata = {
  title: "DRIVE | One Hub. Every Connection.",
  description: "Universal MCP & Agent Skills Hub — connect 25,000+ MCP servers and Agent Skills from one Liquid Glass workspace.",
  icons: {
    icon: [
      { url: "/drive-logo.png", type: "image/png", sizes: "256x256" },
      { url: "/favicon.ico", sizes: "64x64" },
      { url: "/drive-logo.svg", type: "image/svg+xml" },
    ],
    shortcut: "/drive-logo.png",
    apple: "/drive-logo.png",
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
