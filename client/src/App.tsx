import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Indicators from "./pages/Indicators";
import Screener from "./pages/Screener";
import Backtest from "./pages/Backtest";
import Optimization from "./pages/Optimization";
import Monitoring from "./pages/Monitoring";
import Market from "./pages/Market";
import StockDetail from "./pages/StockDetail";
import StockListPanel from "./components/StockListPanel";
import { StockSelectionProvider } from "./components/StockSelectionContext";

function NavBar() {
  return (
    <nav className="flex items-center gap-6 px-6 py-3 bg-gray-900 border-b border-gray-800">
      <h1 className="text-lg font-bold text-blue-400">股票量化分析</h1>
      <a href="/market" className="text-sm text-gray-300 hover:text-white">
        大盘
      </a>
      <a href="/indicators" className="text-sm text-gray-300 hover:text-white">
        技术指标
      </a>
      <a href="/screener" className="text-sm text-gray-300 hover:text-white">
        多因子筛选
      </a>
      <a href="/backtest" className="text-sm text-gray-300 hover:text-white">
        策略回测
      </a>
      <a href="/optimization" className="text-sm text-gray-300 hover:text-white">
        参数优化
      </a>
      <a href="/monitoring" className="text-sm text-gray-300 hover:text-white">
        监控
      </a>
    </nav>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const showStockList = pathname === "/indicators";

  return (
    <div className="min-h-screen bg-gray-950">
      <NavBar />
      <StockSelectionProvider>
        <div className="flex">
          <div className="flex-1 min-w-0">
            <Routes>
              <Route path="/" element={<Navigate to="/indicators" replace />} />
              <Route path="/market" element={<Market />} />
              <Route path="/indicators" element={<Indicators />} />
              <Route path="/stock/:code" element={<StockDetail />} />
              <Route path="/screener" element={<Screener />} />
              <Route path="/backtest" element={<Backtest />} />
              <Route path="/optimization" element={<Optimization />} />
              <Route path="/monitoring" element={<Monitoring />} />
            </Routes>
          </div>
          {showStockList && <StockListPanel />}
        </div>
      </StockSelectionProvider>
    </div>
  );
}
