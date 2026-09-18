import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Opticutter — planowanie cięcia 1D',description:'Planowanie cięcia na długość, magazyn materiałów i pozostałości.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pl"><body>{children}</body></html>;}
