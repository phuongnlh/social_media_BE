require("dotenv").config();
const app = require("./app");
const connDB = require("./config/database.mongo");
const redisClient = require("./config/database.redis");
// const seedAdmin = require("./config/seed");

(async () => {
  try {
    // Kết nối MongoDB
    await connDB();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Server failed to start:", err);
    process.exit(1);
  }
})();
