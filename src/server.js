require("dotenv").config();
require("./workers/moderationWorker");
const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connDB = require("./config/database.mongo");
const redisClient = require("./config/database.redis");

// Tạo HTTP server từ app Express
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://dailyvibe.online",
      "https://admin.dailyvibe.online",
      "https://api.dailyvibe.online",
      `${process.env.FRONTEND_URL}`,
      `${process.env.ADMIN_URL}`,
      `${process.env.BACKEND_URL}`,
    ], // Allow Vite dev server
    methods: ["GET", "POST"],
    credentials: true, // Allow cookies
  },
  maxHttpBufferSize: 1e8,
});

require("./socket")(io);
(async () => {
  try {
    await connDB();

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Server failed to start:", err);
    process.exit(1);
  }
})();
