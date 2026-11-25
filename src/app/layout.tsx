import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Automated Quality Gate',
  description: 'Connect GitHub to review JavaScript pull requests and run Jest tests with Gemini.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..750&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
