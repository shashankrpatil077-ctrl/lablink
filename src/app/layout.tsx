import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LabLink — Making College Laboratories More Accessible',
  description:
    'GenAI-powered campus laboratory resource-sharing platform that helps students discover and access specialised equipment, development kits, and laboratory workstations across departments with intelligent slot booking, faculty approvals, and fair scheduling conflict resolution.',
  keywords: [
    'campus laboratory resource-sharing',
    'equipment discovery',
    'intelligent slot booking',
    'project-based access requests',
    'faculty approvals',
    'optimising resource utilisation',
    'scheduling conflicts',
    'fair equipment allocations',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}

