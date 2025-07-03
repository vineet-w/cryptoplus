'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useLiveData } from './LiveDataContext';
interface ChartModalProps {
  symbol: string;
  onClose: () => void;
  livePrice?: number; // Add live price prop
}

interface PricePoint {
  time: string;
  price: number;
}

export default function ChartModal({ symbol, onClose }: ChartModalProps) {
  const { livePrices } = useLiveData();
  const livePrice = livePrices[symbol];
  const [data, setData] = useState<PricePoint[]>([]);
  const [changePercent, setChangePercent] = useState<number | null>(null);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<number>(Date.now());

  // Function to update with live data
  const updateLivePrice = useCallback(() => {
    if (livePrice && data.length > 0) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      setData(prev => {
        const newData = [...prev];
        const lastPoint = { ...newData[newData.length - 1] };
        
        // Update last point with live price
        lastPoint.price = livePrice;
        lastPoint.time = timeStr;
        
        newData[newData.length - 1] = lastPoint;
        return newData;
      });
      
      setLastLiveUpdate(Date.now());
    }
  }, [livePrice, data]);

  // Fetch historical data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const symbolFull = symbol.toUpperCase();
        const url = `http://localhost:3001/api/klines?symbol=${symbolFull}&interval=1m&limit=60`;
        const res = await fetch(url);
        const raw = await res.json();

        const formatted = raw.map((item: any) => ({
          time: new Date(item[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          price: parseFloat(item[4]),
        }));

        setData(formatted);

        const open = formatted[0].price;
        const close = formatted[formatted.length - 1].price;
        const percentChange = ((close - open) / open) * 100;
        setChangePercent(percentChange);
      } catch (err) {
        console.error('Error fetching Binance data:', err);
      }
    };

    fetchData();
  }, [symbol]);

  // Update with live data when price changes
  useEffect(() => {
    updateLivePrice();
  }, [livePrice, updateLivePrice]);

  // Auto-update every 5 seconds to keep chart fresh
  useEffect(() => {
    const interval = setInterval(updateLivePrice, 5000);
    return () => clearInterval(interval);
  }, [updateLivePrice]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
        >
          &times;
        </button>
        
        <h2 className="text-xl font-bold mb-6 text-center text-gray-800 dark:text-white">
          {symbol.replace('USDT', '')} Price Chart (Live)
        </h2>
        
        <div className="w-full h-[calc(100%-3rem)]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="time" />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '6px', color: 'white' }}
                labelStyle={{ fontSize: 12, color: '#e5e7eb' }}
                formatter={(value) => [`$${(value as number).toFixed(4)}`, 'Price']}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#6366f1" 
                strokeWidth={2} 
                dot={false} 
                name="Price (USD)"
                isAnimationActive={false}
              />
              {changePercent !== null && (
                <ReferenceLine
                  y={data[0]?.price}
                  stroke={changePercent > 0 ? '#22c55e' : '#ef4444'}
                  strokeDasharray="3 3"
                  label={{
                    value: `Change: ${changePercent.toFixed(2)}%`,
                    position: 'top',
                    fill: changePercent > 0 ? '#22c55e' : '#ef4444',
                    fontSize: 14,
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>1-minute intervals • Live updates every 5 seconds</p>
          <p className="mt-1">Last update: {new Date(lastLiveUpdate).toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
}