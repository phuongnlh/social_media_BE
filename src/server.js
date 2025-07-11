require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connDB = require("./config/database.mongo");
const redisClient = require("./config/database.redis");

// Tạo HTTP server từ app Express
const server = http.createServer(app);

// Tạo socket server
const io = new Server(server, {
  cors: {
    origin: "*", // Hoặc domain FE bạn dùng
    methods: ["GET", "POST"],
  },
});

// Import logic Socket.IO (nếu có)
require("./socket")(io); // bạn có thể tạo file socket/index.js để gọn

(async () => {
  try {
    await connDB();

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`✅ Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Server failed to start:", err);
    process.exit(1);
  }
})();
