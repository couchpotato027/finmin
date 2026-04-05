import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AdvancedChart from './pages/AdvancedChart';
import Layout from './components/Layout';

// Optimization 7: Lazy load heavy pages to reduce initial bundle size
const MarketScanner = lazy(() => import('./pages/MarketScanner'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Backtest = lazy(() => import('./pages/Backtest'));

const LoadingFallback = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '60vh', color: 'rgba(255,255,255,0.3)', fontSize: '14px',
    fontFamily: 'Inter, sans-serif', letterSpacing: '0.5px'
  }}>
    Loading...
  </div>
);

function App() {
  // Optimization 6: Keep Railway backend alive (ping every 10 min)
  useEffect(() => {
    const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8000';
    const keepAlive = () => {
      fetch(`${API_BASE}/api/health`).catch(() => {});
    };
    keepAlive();
    const interval = setInterval(keepAlive, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/advanced-chart" element={<AdvancedChart />} />
        <Route path="/scanner" element={
          <Layout><Suspense fallback={<LoadingFallback />}><MarketScanner /></Suspense></Layout>
        } />
        <Route path="/analytics" element={
          <Layout><Suspense fallback={<LoadingFallback />}><Analytics /></Suspense></Layout>
        } />
        <Route path="/portfolio" element={
          <Layout><Suspense fallback={<LoadingFallback />}><Portfolio /></Suspense></Layout>
        } />
        <Route path="/backtest" element={
          <Layout><Suspense fallback={<LoadingFallback />}><Backtest /></Suspense></Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;
