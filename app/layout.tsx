import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpenSpec Approvals',
  description: 'Review OpenSpec artifacts with searchable dashboard and approvals.',
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">
              OpenSpec Approvals
            </Link>
            <nav className="nav">
              <Link href="/">Changes</Link>
              <Link href="/search">Search</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
