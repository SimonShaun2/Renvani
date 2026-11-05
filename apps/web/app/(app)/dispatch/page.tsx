import { Geist, Geist_Mono } from "next/font/google";
import { DispatchViewRouter } from "@/src/components/dispatch/DispatchViewRouter";

const workflowSans = Geist({ subsets: ["latin"], display: "swap", variable: "--font-workflow-sans" });
const workflowMono = Geist_Mono({ subsets: ["latin"], display: "swap", variable: "--font-geist-mono" });

export default function DispatchPage() {
  return <div className={`${workflowSans.variable} ${workflowMono.variable}`}><DispatchViewRouter /></div>;
}
