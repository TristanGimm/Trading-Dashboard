import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'Trading Dashboard',description:'Private trading journal and analytics',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try { const theme = localStorage.getItem("gimm-theme"); document.documentElement.dataset.theme = theme === "light" ? "light" : "dark"; } catch {}` }}/></head><body className="antialiased">{children}</body></html>}
