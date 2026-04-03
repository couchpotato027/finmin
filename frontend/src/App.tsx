import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AdvancedChart from './pages/AdvancedChart';
import MarketScanner from './pages/MarketScanner';
import Analytics from './pages/Analytics';
import Portfolio from './pages/Portfolio';
import Backtest from './pages/Backtest';

import Layout from './components/Layout';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/scanner" element={<Layout><MarketScanner /></Layout>} />
        <Route path="/advanced-chart" element={<AdvancedChart />} />
        <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
        <Route path="/portfolio" element={<Layout><Portfolio /></Layout>} />
        <Route path="/backtest" element={<Layout><Backtest /></Layout>} />
      </Routes>
    </Router>
  );
}

export default App;
