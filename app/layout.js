import "./globals.css";
import { AppProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";

export const metadata = {
  title: "Mahoratli pedagog",
  description: "Boʻlajak boshlangʻich sinf oʻqituvchilari uchun taʼlim platformasi",
};

export default function RootLayout({ children }) {
  return (
    <html lang="uz">
      <body>
        <ThemeProvider>
          <AppProvider>{children}</AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
