import type { Metadata } from "next";
import { Inter, Pacifico } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import ThemeProvider from "@/components/theme/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });
// Brush-script font for the header motivational quote. Swap the import here to
// change the look; exposed as --font-script. (To use a custom "Mitchell" file,
// switch this to next/font/local pointing at the font in /public or /src.)
const pacifico = Pacifico({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hemisphere",
  description: "Hemisphere — team operations & ticketing",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${pacifico.variable}`}>
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
