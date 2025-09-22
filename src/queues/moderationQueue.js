// queues/moderationQueue.js
const { Queue } = require("bullmq");
const { redisConfig } = require("../config/database.redis");

const moderationQueue = new Queue("moderation", {
  connection: redisConfig,
});

const moderationService = {
  async checkCommentImage(commentId, url, mediaType = "image") {
    try {
      const job = await moderationQueue.add(
        "checkImageComment",
        { commentId, url, mediaType },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 10,
          removeOnFail: 5,
        }
      );

      console.log(`Moderation job ${job.id} queued for comment ${commentId}`);
      return job.id;
    } catch (error) {
      console.error("Error queuing comment moderation:", error);
      throw error;
    }
  },

  async checkPostWithMultipleImages(postId, images) {
    try {
      console.log(
        `Queuing moderation for post ${postId} with ${images.length} images`
      );

      const job = await moderationQueue.add(
        "checkPostMultipleImages",
        {
          postId,
          images: images.map((img) => ({
            url: img.url,
            mediaType: img.mediaType || "image",
          })),
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: 10,
          removeOnFail: 5,
        }
      );

      console.log(`Moderation job ${job.id} queued for post ${postId}`);
      return job.id;
    } catch (error) {
      console.error("Error queuing post moderation:", error);
      throw error;
    }
  },

  async checkSinglePostImage(postId, url, mediaType = "image") {
    try {
      const job = await moderationQueue.add(
        "checkImagePost",
        { postId, url, mediaType },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 10,
          removeOnFail: 5,
        }
      );

      return job.id;
    } catch (error) {
      console.error("Error queuing single post image moderation:", error);
      throw error;
    }
  },
};

module.exports = moderationService;
