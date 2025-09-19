// queues/moderationQueue.js
const { Queue } = require("bullmq");
const { redisConfig } = require("../config/database.redis");

const moderationQueue = new Queue("moderation", {
  connection: redisConfig,
});

module.exports = moderationQueue;
