import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from './state/AppState.jsx';
import { translate, useI18n } from './i18n/index.jsx';
import Nav from './components/Nav.jsx';
import { ConsentBar, FlyToSleigh, Footer, SleighDrawer, Toasts } from './components/Shell.jsx';
import { Loader } from './components/Common.jsx';
import WelcomeGate from './components/WelcomeGate.jsx';
import SkyCanvas from './effects/SkyCanvas.jsx';
import CursorMagic from './effects/CursorMagic.jsx';
import { SnowAccumulator } from './effects/SnowCap.jsx';
import { introPlan, markIntroSeen } from './effects/introPrefs.js';
import Home from './pages/Home.jsx';

const SantaIntro = lazy(() => import('./effects/SantaIntro.jsx'));
const Shop = lazy(() => import('./pages/Shop.jsx'));
const Product = lazy(() => import('./pages/Product.jsx'));
const GiftFinder = lazy(() => import('./pages/GiftFinder.jsx'));
const Advent = lazy(() => import('./pages/Advent.jsx'));
const Games = lazy(() => import('./pages/Games.jsx'));
const Academy = lazy(() => import('./pages/Academy.jsx'));
const Pioneer = lazy(() => import('./pages/Pioneer.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Order = lazy(() => import('./pages/Order.jsx'));
const TestPayment = lazy(() => import('./pages/TestPayment.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const Auth = lazy(() => import('./pages/Auth.jsx'));
const Info = lazy(() => import('./pages/Info.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

/** Keeps the village standing if one page throws: shows a friendly message instead of a blank screen. */
class PageErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error(error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="wrap"><div className="empty error-boundary"><h3>{translate('notFound.title')}</h3><p className="muted">{translate('common.error')}</p><a className="btn" href="/">{translate('notFound.back')}</a></div></div>
    );
  }
}

function Page({ children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
      <PageErrorBoundary>{children}</PageErrorBoundary>
    </motion.div>
  );
}

export default function App() {
  const location = useLocation();
  const { calm, refreshCart, refreshUser } = useApp();
  const { lang, t } = useI18n();
  // Intro is decided once per page load (never on in-app navigation).
  const [intro, setIntro] = useState(() => introPlan(location.pathname, calm));
  const [gate, setGate] = useState(false);
  const isAdmin = location.pathname.startsWith('/admin');
  const firstLang = useRef(lang);

  // The welcome ritual (name + atmosphere) is optional: it never blocks shopping and only opens when the
  // visitor chooses "Personalise" on the home page.

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  // Language switch: content from the server is localized, so refresh what is cached client-side.
  useEffect(() => {
    if (firstLang.current === lang) return;
    firstLang.current = lang;
    refreshCart().catch(() => {});
    refreshUser().catch(() => {});
  }, [lang, refreshCart, refreshUser]);

  useEffect(() => {
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('home.studied'));
  }, [t]);

  const endIntro = useCallback(() => {
    markIntroSeen();
    setIntro(null);
  }, []);

  if (isAdmin) {
    return (
      <Suspense fallback={<Loader label={t('common.loading')} />}>
        <Routes><Route path="/admin/*" element={<AdminApp />} /></Routes>
        <Toasts />
      </Suspense>
    );
  }

  return (
    <>
      <SkyCanvas />
      <CursorMagic />
      <SnowAccumulator />
      <div className="app">
        <a className="sr-only" href="#main">{t('nav.skip')}</a>
        <Nav />
        <main id="main">
          <Suspense fallback={<Loader label={t('common.loading')} />}>
            <AnimatePresence mode="wait">
              {/* keyed by language too, so every page refetches localized content after a switch */}
              <Routes location={location} key={`${lang}:${location.pathname}`}>
                <Route path="/" element={<Page><Home onReplayWelcome={() => setGate(true)} /></Page>} />
                <Route path="/shop" element={<Page><Shop /></Page>} />
                <Route path="/shop/:category" element={<Page><Shop /></Page>} />
                <Route path="/product/:slug" element={<Page><Product /></Page>} />
                <Route path="/gift-finder" element={<Page><GiftFinder /></Page>} />
                <Route path="/advent" element={<Page><Advent /></Page>} />
                <Route path="/games/*" element={<Page><Games /></Page>} />
                <Route path="/academy/*" element={<Page><Academy /></Page>} />
                <Route path="/pioneer" element={<Page><Pioneer /></Page>} />
                <Route path="/cart" element={<Page><Cart /></Page>} />
                <Route path="/checkout" element={<Page><Checkout /></Page>} />
                <Route path="/order/:number" element={<Page><Order /></Page>} />
                <Route path="/track" element={<Page><Order /></Page>} />
                <Route path="/pay/test/:id" element={<Page><TestPayment /></Page>} />
                <Route path="/account/*" element={<Page><Account /></Page>} />
                <Route path="/login" element={<Page><Auth mode="login" /></Page>} />
                <Route path="/register" element={<Page><Auth mode="register" /></Page>} />
                <Route path="/info/:topic" element={<Page><Info /></Page>} />
                <Route path="*" element={<Page><NotFound /></Page>} />
              </Routes>
            </AnimatePresence>
          </Suspense>
        </main>
        <Footer onReplayIntro={() => setIntro('full')} />
      </div>
      <SleighDrawer />
      <FlyToSleigh />
      {!intro && <ConsentBar />}
      <Toasts />
      {intro && (
        <Suspense fallback={<div className="santa-intro" />}>
          <SantaIntro variant={intro} onDone={endIntro} />
        </Suspense>
      )}
      <AnimatePresence>{gate && <WelcomeGate onClose={() => setGate(false)} />}</AnimatePresence>
    </>
  );
}
