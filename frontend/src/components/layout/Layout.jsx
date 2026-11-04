import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Footer from './Footer.jsx';
import Header from './Header.jsx';
import WhatsAppButton from './WhatsAppButton.jsx';

export default function Layout() {
  const { pathname } = useLocation();
  // Braces matter: newer browsers return a Promise from scrollTo, which React
  // would treat as a broken clean-up function
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
