const { Worker } = require("bullmq");
const Comment = require("../models/Comment_Reaction/comment.model");
const grpcClient = require("../services/grpcClient");
const { redisConfig } = require("../config/database.redis");
const moderationWorker = new Worker(
  "moderation",
  async (job) => {
    if (job.name === "checkImage") {
      const { commentId, url, mediaType } = job.data;

      return new Promise((resolve, reject) => {
        grpcClient.CheckImage(
          { base_url: url, media_file: mediaType },
          async (err, response) => {
            if (err) {
              console.error("gRPC CheckImage error:", err);
              return reject(err);
            }

            // update DB với kết quả
            const update = { moderation_status: response.label };
            await Comment.findByIdAndUpdate(commentId, update);

            console.log("Moderation result:", response);
            resolve(response);
          }
        );
      });
    }
  },
  { connection: redisConfig }
);

moderationWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});
moderationWorker.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});
