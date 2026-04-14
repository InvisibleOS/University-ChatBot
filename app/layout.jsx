import './globals.css';

export const metadata = {
  title: 'MIT Bengaluru Assistant',
  description: 'AI powered virtual assistant',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
