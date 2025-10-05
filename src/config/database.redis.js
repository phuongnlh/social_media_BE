const redis = require("redis");
require("dotenv").config();

const redisClient = redis.createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    connectTimeout: 10000,
  },
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

(async () => {
  await redisClient.connect();
  console.log("✅ Redis connected");
})();

module.exports = redisClient;

module.exports.redisConfig = {
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
};
