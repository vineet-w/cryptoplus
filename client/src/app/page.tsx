"use client";

import { useEffect, useState, useCallback } from "react";
import ThemeToggle from "../components/ThemeToggle";
import CryptoChart from "../components/CryptoChart";
import ChartModal from "../components/ChartModal"; 
import { LiveDataProvider } from "@/components/LiveDataContext";
import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { ArrowDownTrayIcon, ClockIcon } from "@heroicons/react/24/outline";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

interface CryptoData {
  symbol: string;
  price: string;
  change24h: string;
  changeColor: string;
  livePrice?: number;
  history?: PricePoint[];
}

interface PricePoint {
  time: string;
  price: number;
}

export default function CryptoDashboard() {
  const TOP_CRYPTOS = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT'
  ];
  
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cryptoFavorites');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState<Record<string, boolean>>({});

  // Save favorites to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cryptoFavorites', JSON.stringify(favorites));
    }
  }, [favorites]);

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => 
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  // Fetch 24-hour price history
  const fetchPriceHistory = useCallback(async (symbol: string) => {
    setIsLoadingHistory(prev => ({ ...prev, [symbol]: true }));
    try {
      const response = await fetch(
        `http://localhost:3001/api/klines?symbol=${symbol}&interval=1h&limit=24`
      );
      const data = await response.json();
      
      const history = data.map((item: any) => ({
        time: new Date(item[0]).toLocaleTimeString([], { hour: '2-digit' }),
        price: parseFloat(item[4])
      }));

      setCryptoData(prev => prev.map(crypto => 
        crypto.symbol === symbol ? { ...crypto, history } : crypto
      ));
    } catch (error) {
      console.error(`Failed to fetch history for ${symbol}:`, error);
    } finally {
      setIsLoadingHistory(prev => ({ ...prev, [symbol]: false }));
    }
  }, []);

  // Download report as CSV
  const downloadReport = useCallback(() => {
    const headers = "Symbol,Price,24h Change,Favorite\n";
    const csvContent = cryptoData.map(crypto => 
      `${crypto.symbol.replace("USDT", "")},${crypto.price.replace(/,/g, "")},${crypto.change24h},${favorites.includes(crypto.symbol) ? "Yes" : "No"}`
    ).join("\n");
    
    const blob = new Blob([headers + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `crypto-report-${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [cryptoData, favorites]);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3001");

    socket.onopen = () => {
      setIsConnected(true);
      console.log("Connected to backend WebSocket");
    };

    socket.onmessage = async (event) => {
      try {
        let data;
        if (event.data instanceof Blob) {
          data = JSON.parse(await event.data.text());
        } else {
          data = JSON.parse(event.data);
        }

        if (Array.isArray(data)) {
          // Update live prices
          const newLivePrices: Record<string, number> = {};
          data.forEach(item => {
            if (item.s && item.c) {
              newLivePrices[item.s] = parseFloat(item.c);
            }
          });
          setLivePrices(prev => ({ ...prev, ...newLivePrices }));
          
          const newData: CryptoData[] = [];
          
          data.forEach((item) => {
            if (item.s && TOP_CRYPTOS.includes(item.s.toUpperCase())) {
              const symbol = item.s.toUpperCase();
              const priceChangePercent = parseFloat(item.P);
              const changeColor = priceChangePercent >= 0 ? "text-green-500" : "text-red-500";
              const livePrice = parseFloat(item.c);

              newData.push({
                symbol: symbol,
                price: livePrice.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: livePrice < 1 ? 4 : 2,
                }),
                change24h: `${priceChangePercent.toFixed(2)}%`,
                changeColor: changeColor,
                livePrice: livePrice
              });
            }
          });

          // Sort with favorites first
          const orderMap = new Map(TOP_CRYPTOS.map((symbol, index) => [symbol, index]));
          newData.sort((a, b) => {
            const aIsFavorite = favorites.includes(a.symbol);
            const bIsFavorite = favorites.includes(b.symbol);
            
            if (aIsFavorite && !bIsFavorite) return -1;
            if (!aIsFavorite && bIsFavorite) return 1;
            
            const aIndex = orderMap.get(a.symbol) || Infinity;
            const bIndex = orderMap.get(b.symbol) || Infinity;
            return aIndex - bIndex;
          });

          setCryptoData(newData);
          setLastUpdate(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error("Error processing message:", err);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      console.log("Disconnected from backend WebSocket");
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [favorites, TOP_CRYPTOS]);

  return (
    <LiveDataProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-6 transition-colors duration-300">
        <div className="max-w-7xl mx-auto">
          <header className="mb-10 text-center relative">
            <div className="absolute top-0 right-0 flex space-x-4">
              <button
                onClick={downloadReport}
                className="flex items-center space-x-1 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                title="Download Report"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                <span className="text-sm">Report</span>
              </button>
              <ThemeToggle />
            </div>
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
              CryptoPulse
            </h1>
            <div className="flex items-center justify-center mt-2 space-x-2">
              <span
                className={`h-3 w-3 rounded-full animate-pulse ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              ></span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {isConnected
                  ? `Connected • Updated at ${lastUpdate}`
                  : "Disconnected"}
              </span>
            </div>
          </header>
          
          {/* Chart Modal */}
          {selectedChart && (
            <ChartModal 
              symbol={selectedChart} 
              onClose={() => setSelectedChart(null)}
              livePrice={livePrices[selectedChart]} 
            />
          )}
          
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-6 gap-4 p-4 bg-gray-100 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              <div>Coin</div>
              <div className="text-right">Price</div>
              <div className="text-right">24h Change</div>
              <div className="text-right">Chart</div>
              {/* <div className="text-right">History</div> */}
              <div className="text-right">Favorite</div>
            </div>

            {cryptoData.length > 0 ? (
              cryptoData.map((crypto) => (
                <div
                  key={crypto.symbol}
                  className="grid grid-cols-6 gap-4 p-4 items-center border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
                >
                  <div className="flex items-center">
                    <div className="bg-indigo-100 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-100 rounded-full h-8 w-8 flex items-center justify-center mr-3 font-semibold text-sm shadow">
                      {crypto.symbol[0]}
                    </div>
                    <span className="font-medium text-gray-800 dark:text-white">
                      {crypto.symbol.replace("USDT", "")}
                    </span>
                  </div>
                  <div className="text-right font-mono text-gray-700 dark:text-gray-200">
                    {crypto.price}
                  </div>
                  <div className={`text-right font-mono ${crypto.changeColor}`}>
                    {crypto.change24h}
                  </div>
                  <div className="flex justify-end">
                    <div className="w-40 h-24">
                      <CryptoChart 
                        symbol={crypto.symbol} 
                        onChartClick={() => setSelectedChart(crypto.symbol)}
                        livePrice={crypto.livePrice}
                      />
                    </div>
                  </div>
                  {/* <div className="flex justify-end">
                    <button
                      onClick={() => fetchPriceHistory(crypto.symbol)}
                      disabled={isLoadingHistory[crypto.symbol]}
                      className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title="View 24h History"
                    >
                      {isLoadingHistory[crypto.symbol] ? (
                        <span className="animate-pulse">Loading...</span>
                      ) : (
                        <ClockIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div> */}
                  <div className="flex justify-end">
                    <button 
                      onClick={() => toggleFavorite(crypto.symbol)}
                      className="text-yellow-400 hover:text-yellow-500 transition-colors group relative"
                    >
                      {favorites.includes(crypto.symbol) ? (
                        <>
                          <StarSolid className="h-5 w-5" />
                          <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            Remove favorite
                          </span>
                        </>
                      ) : (
                        <>
                          <StarOutline className="h-5 w-5" />
                          <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            Add to favorites
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                  {/* History Chart - shown when available */}
                  {crypto.history && (
                    <div className="col-span-6 mt-4">
                      <div className="h-64">
                        <h3 className="text-sm font-medium mb-2">
                          24h Price History for {crypto.symbol.replace("USDT", "")}
                        </h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart 
                            data={crypto.history}
                            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                            <XAxis dataKey="time" />
                            <YAxis domain={['auto', 'auto']} />
                            <Tooltip
                              contentStyle={{ 
                                backgroundColor: '#1f2937', 
                                border: 'none', 
                                borderRadius: '6px' 
                              }}
                              formatter={(value: number) => [`$${value.toFixed(4)}`, 'Price']}
                              labelFormatter={(label) => `Time: ${label}`}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="price" 
                              stroke="#6366f1" 
                              strokeWidth={2} 
                              dot={false}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                {isConnected
                  ? "Loading cryptocurrency data..."
                  : "Connecting to WebSocket..."}
              </div>
            )}
          </div>

          <footer className="mt-10 text-center text-xs text-gray-500 dark:text-gray-400">
            <p>Data from Binance • Updated in real-time via Node.js WebSocket</p>
            <p className="mt-1">
              This dashboard is for educational/demo purposes only.
            </p>
          </footer>
        </div>
      </div>
    </LiveDataProvider>
  );
}