const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const axios = require("axios");
const cors = require("cors");

const TOP_CRYPTOS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT'
];

const app = express();
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// Store historical data
const historicalData = new Map();

// Handle klines endpoint
app.get("/api/klines", async (req, res) => {
  const { symbol, interval = "1h", limit = 24 } = req.query;
  
  if (!symbol || !symbol.toUpperCase().endsWith('USDT')) {
    return res.status(400).json({ error: "Invalid symbol format" });
  }

  try {
    const response = await axios.get("https://api.binance.com/api/v3/klines", {
      params: { 
        symbol: symbol.toUpperCase(), 
        interval, 
        limit 
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error("Binance API error:", error.message);
    res.status(500).json({ error: "Failed to fetch Binance data" });
  }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let binanceSocket;
const liveData = new Map();

// Start Binance WebSocket
function connectToBinance() {
  const binanceStream = "wss://stream.binance.com:9443/ws/!ticker@arr";

  binanceSocket = new WebSocket(binanceStream);

  binanceSocket.on("open", () => {
    console.log("Connected to Binance WebSocket");
    // Initialize live data
    TOP_CRYPTOS.forEach(symbol => {
      liveData.set(symbol, {
        price: 0,
        change24h: 0,
        timestamp: Date.now()
      });
    });
  });

  binanceSocket.on("message", (data) => {
    try {
      const parsedData = JSON.parse(data);
      const filtered = parsedData.filter(item => 
        TOP_CRYPTOS.includes(item.s) && 
        item.s.endsWith("USDT") && 
        !item.s.includes("UP") && 
        !item.s.includes("DOWN")
      );
      
      // Update live data
      filtered.forEach(item => {
        liveData.set(item.s, {
          price: parseFloat(item.c),
          change24h: parseFloat(item.P),
          timestamp: Date.now()
        });
      });
      
      broadcastToClients(JSON.stringify(filtered));
    } catch (error) {
      console.error("Error processing Binance data:", error);
    }
  });

  binanceSocket.on("close", () => {
    console.warn("Binance WebSocket closed. Reconnecting...");
    setTimeout(connectToBinance, 5000);
  });

  binanceSocket.on("error", (err) => {
    console.error("Binance WebSocket error:", err);
    binanceSocket.close();
  });
}

// Broadcast to all clients
function broadcastToClients(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Handle client connections
wss.on("connection", (ws) => {
  console.log("Frontend connected");
  
  // Send initial live data
  const initialData = Array.from(liveData.entries()).map(([symbol, data]) => ({
    s: symbol,
    c: data.price.toString(),
    P: data.change24h.toString()
  }));
  
  ws.send(JSON.stringify(initialData));
  
  ws.on("close", () => {
    console.log("Frontend disconnected");
  });
});

// Start the Binance connection
connectToBinance();

// Start the server
server.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
  console.log("WebSocket server running on ws://localhost:3001");
});