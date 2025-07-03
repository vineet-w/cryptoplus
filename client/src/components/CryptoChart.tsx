'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { useLiveData } from './LiveDataContext';
interface CryptoChartProps {
  symbol: string;
  onChartClick?: () => void;
  livePrice?: number;
}

interface PricePoint {
  time: string;
  price: number;
}

export default function CryptoChart({ symbol, onChartClick }: CryptoChartProps) {
const { livePrices } = useLiveData();
const livePrice = livePrices[symbol];
const [data, setData] = useState<PricePoint[]>([]);
  const [changePercent, setChangePercent] = useState<number | null>(null);
  const lastLivePriceRef = useRef<number | null>(null);
  const dataRef = useRef<PricePoint[]>([]);

  // Initialize dataRef when data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Update with live data
  const updateLivePrice = useCallback(() => {
    if (livePrice !== undefined && livePrice !== lastLivePriceRef.current) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      setData(prev => {
        if (prev.length === 0) return prev;
        
        const newData = [...prev];
        const lastPoint = { ...newData[newData.length - 1] };
        
        // Only update if price changed
        if (lastPoint.price !== livePrice) {
          lastPoint.price = livePrice;
          lastPoint.time = timeStr;
          newData[newData.length - 1] = lastPoint;
          return newData;
        }
        return prev;
      });

      lastLivePriceRef.current = livePrice;
    }
  }, [livePrice]);

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
    const interval = setInterval(() => {
      if (dataRef.current.length > 0) {
        updateLivePrice();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [updateLivePrice]);

  return (
    <div 
      className="w-full h-24 cursor-pointer" 
      onClick={onChartClick}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={20} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '6px', color: 'white' }}
            labelStyle={{ fontSize: 12, color: '#e5e7eb' }}
            formatter={(value) => [`$${(value as number).toFixed(4)}`, 'Price']}
          />
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="#6366f1" 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={false}
          />
          {changePercent !== null && (
            <ReferenceLine
              y={data[0]?.price}
              stroke={changePercent > 0 ? '#22c55e' : '#ef4444'}
              strokeDasharray="3 3"
              label={{
                value: `${changePercent.toFixed(2)}%`,
                position: 'right',
                fill: changePercent > 0 ? '#22c55e' : '#ef4444',
                fontSize: 12,
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}