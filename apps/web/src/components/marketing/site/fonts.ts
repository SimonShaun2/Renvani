import { Geist, Inter, Newsreader } from "next/font/google";

export const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--font-mkt-sans" });
export const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-mkt-ui" });
export const newsreader = Newsreader({ subsets: ["latin"], style: ["italic"], weight: ["400"], display: "swap", variable: "--font-mkt-serif" });
