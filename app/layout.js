import "./globals.css";
import { AppProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ToastProvider } from "@/components/ToastProvider";

const SITE_NAME = "Mahoratli pedagog";
const DESCRIPTION = "Boʻlajak boshlangʻich sinf oʻqituvchilari uchun taʼlim platformasi";

export const metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  description: DESCRIPTION,
  openGraph: { siteName: SITE_NAME, type: "website", locale: "uz_UZ", title: SITE_NAME, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: DESCRIPTION },
};

export default function RootLayout({ children }) {
  return (
    <html lang="uz">
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AppProvider>{children}</AppProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
