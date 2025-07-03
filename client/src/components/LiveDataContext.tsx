// context/LiveDataContext.tsx
'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface LiveDataContextType {
  livePrices: Record<string, number>;
}

const LiveDataContext = createContext<LiveDataContextType>({ livePrices: {} });

export function LiveDataProvider({ children }: { children: React.ReactNode }) {
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3001");

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          const newPrices: Record<string, number> = {};
          data.forEach(item => {
            if (item.s && item.c) {
              newPrices[item.s] = parseFloat(item.c);
            }
          });
          setLivePrices(prev => ({ ...prev, ...newPrices }));
        }
      } catch (err) {
        console.error("Error processing live data:", err);
      }
    };

    return () => socket.close();
  }, []);

  return (
    <LiveDataContext.Provider value={{ livePrices }}>
      {children}
    </LiveDataContext.Provider>
  );
}

export function useLiveData() {
  return useContext(LiveDataContext);
}