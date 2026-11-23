import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LabLink',
  description: 'GenAI-powered campus laboratory resource-sharing platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
