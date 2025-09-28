const { Worker } = require("bullmq");
const Comment = require("../models/Comment_Reaction/comment.model");
const grpcClient = require("../services/grpcClient");
const { redisConfig } = require("../config/database.redis");
const postModel = require("../models/post.model");
const moderationWorker = new Worker(
  "moderation",
  async (job) => {
    if (job.name === "checkImageComment") {
      const { commentId, url, mediaType } = job.data;

      return new Promise((resolve, reject) => {
        grpcClient.CheckImage(
          { base_url: url, media_file: mediaType },
          async (err, response) => {
            if (err) {
              console.error("gRPC CheckImage error:", err);
              return reject(err);
            }
            let update;
            // update DB với kết quả
            if (response.label !== "normal") {
              update = { moderation_status: response.label, isDeleted: true };
            } else {
              update = { moderation_status: response.label };
            }
            await Comment.findByIdAndUpdate(commentId, update);

            console.log("Moderation result:", response);
            resolve(response);
          }
        );
      });
    }
    if (job.name === "checkImagePost") {
      const { postId, url, mediaType } = job.data;

      return new Promise((resolve, reject) => {
        grpcClient.CheckImage(
          { base_url: url, media_file: mediaType },
          async (err, response) => {
            if (err) {
              console.error("gRPC CheckImage error:", err);
              return reject(err);
            }

            let update;
            // update DB với kết quả
            if (response.label !== "normal") {
              update = { moderation_status: response.label, isDeleted: true };
            } else {
              update = { moderation_status: response.label };
            }

            // Sửa: update Post thay vì Comment
            await postModel.findByIdAndUpdate(postId, update);

            console.log("Post moderation result:", response);
            resolve(response);
          }
        );
      });
    }
    if (job.name === "checkPostMultipleImages") {
      const { postId, images } = job.data;

      try {
        console.log(
          `Processing post ${postId} with ${images.length} images (PARALLEL)`
        );

        // Process all images in parallel
        const moderationPromises = images.map((image, index) => {
          return new Promise((resolve, reject) => {
            grpcClient.CheckImage(
              { base_url: image.url, media_file: image.mediaType },
              (err, response) => {
                if (err) {
                  console.error(
                    `gRPC CheckImage error for image ${index + 1}:`,
                    err
                  );
                  return reject(err);
                }
                resolve({
                  imageIndex: index,
                  url: image.url,
                  label: response.label,
                  score: response.score,
                });
              }
            );
          });
        });

        // Wait for all images to be processed
        const moderationResults = await Promise.all(moderationPromises);

        // Analyze results
        const violatedImages = moderationResults.filter(
          (r) => r.label !== "normal"
        );
        const hasViolation = violatedImages.length > 0;
        const violationType = hasViolation ? violatedImages[0].label : "normal";

        // Update post
        const update = hasViolation
          ? {
              moderation_status: violationType,
              is_deleted: true,
              moderation_details: {
                total_images: images.length,
                violation_count: violatedImages.length,
                results: moderationResults,
              },
            }
          : {
              moderation_status: "normal",
              moderation_details: {
                total_images: images.length,
                violation_count: 0,
                results: moderationResults,
              },
            };

        await postModel.findByIdAndUpdate(postId, update);

        console.log(
          `Post ${postId} processed: ${hasViolation ? "VIOLATED" : "APPROVED"}`
        );

        return {
          postId,
          totalImages: images.length,
          hasViolation,
          violationType,
          results: moderationResults,
        };
      } catch (error) {
        console.error(`Error processing post ${postId}:`, error);
        await postModel.findByIdAndUpdate(postId, {
          moderation_status: "error",
          moderation_error: error.message,
        });
        throw error;
      }
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
