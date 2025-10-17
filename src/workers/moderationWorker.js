const { Worker } = require("bullmq");
const Comment = require("../models/Comment_Reaction/comment.model");
const grpcClient = require("../services/grpcClient");
const { redisConfig } = require("../config/database.redis");
const postModel = require("../models/post.model");
const userModel = require("../models/user.model");
const { getSocketIO, getNotificationUserSocketMap } = require("../socket/io-instance");
const notificationService = require("../services/notification.service");
const pLimit = require("p-limit");
const net = require("net");

const limit = pLimit(3); // max 3 request song song

// Kiểm tra gRPC service trước khi gọi
async function isGrpcAlive(host = "localhost", port = 50051) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.connect(port, host);
  });
}

// Wrapper safe gRPC call với retry/backoff
async function safeCheckImage(data, retries = 3) {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < retries; i++) {
    try {
      return await new Promise((resolve, reject) => {
        grpcClient.CheckImage(data, (err, response) => {
          if (err) return reject(err);
          resolve(response);
        });
      });
    } catch (err) {
      console.warn(`gRPC error (${i + 1}/${retries}): ${err.code || err.message}`);
      if (i < retries - 1) await delay(1000 * (i + 1)); // backoff tăng dần
    }
  }
  throw new Error("gRPC connection failed after retries");
}

const moderationWorker = new Worker(
  "moderation",
  async (job) => {
    try {
      // Nếu gRPC service không chạy, skip job
      if (!(await isGrpcAlive())) {
        console.warn("gRPC service unavailable, skipping job:", job.name);
        return;
      }

      if (job.name === "checkImageComment") {
        const { commentId, url, mediaType } = job.data;

        try {
          const response = await safeCheckImage({ base_url: url, media_type: mediaType });

          const update =
            response.label !== "normal"
              ? { moderation_status: response.label, is_deleted: true }
              : { moderation_status: response.label };

          const comment = await Comment.findByIdAndUpdate(commentId, update, { new: true });

          if (response.label !== "normal") {
            try {
              const io = getSocketIO();
              const notificationsNamespace = io.of("/notifications");
              const notificationUserSocketMap = getNotificationUserSocketMap();

              await notificationService.createNotificationWithNamespace(
                notificationsNamespace,
                comment.user_id.toString(),
                "system",
                `Your comment has been blocked due to policy violation.`,
                notificationUserSocketMap,
                { fromUser: null, relatedId: comment.postgr_id || comment.post_id }
              );
            } catch (notifyErr) {
              console.error("Error sending notification:", notifyErr);
            }
          }

          console.log(`[MODERATION] Comment ${commentId}: ${response.label}`);
          return response;
        } catch (err) {
          console.error(`Failed to process comment ${commentId}:`, err);
          throw err;
        }
      } else if (job.name === "checkImagePost") {
        const { postId, url, mediaType } = job.data;

        try {
          const response = await safeCheckImage({ base_url: url, media_type: mediaType });

          const update =
            response.label === "normal"
              ? { moderation_status: response.label }
              : { moderation_status: response.label, is_deleted: true };

          const post = await postModel.findByIdAndUpdate(postId, update, { new: true });

          if (response.label !== "normal") {
            try {
              const io = getSocketIO();
              const notificationsNamespace = io.of("/notifications");
              const notificationUserSocketMap = getNotificationUserSocketMap();

              await notificationService.createNotificationWithNamespace(
                notificationsNamespace,
                post.user_id.toString(),
                "system",
                `Your post has been blocked due to policy violation.`,
                notificationUserSocketMap,
                { fromUser: null, relatedId: postId }
              );
            } catch (notifyErr) {
              console.error("Error sending notification:", notifyErr);
            }

            const moderationPosts = await postModel.countDocuments({
              user_id: post.user_id,
              moderation_status: { $ne: "normal" },
            });

            if (moderationPosts > 5) {
              await userModel.findByIdAndUpdate(post.user_id, { is_blocked: true });
            }
          }

          console.log(`[MODERATION] Post ${postId}: ${response.label}`);
          return response;
        } catch (err) {
          console.error(`Failed to process post ${postId}:`, err);
          throw err;
        }
      } else if (job.name === "checkPostMultipleImages") {
        const { postId, images } = job.data;

        try {
          console.log(`Processing post ${postId} with ${images.length} images (PARALLEL)`);

          // Process images với concurrency giới hạn
          const moderationPromises = images.map((image, index) =>
            limit(() =>
              safeCheckImage({ base_url: image.url, media_type: image.mediaType })
                .then((response) => ({
                  imageIndex: index,
                  url: image.url,
                  label: response.label,
                  score: response.score,
                }))
                .catch((err) => {
                  console.error(`Image ${index + 1} failed:`, err.message);
                  return { imageIndex: index, url: image.url, label: "error", score: 0 };
                })
            )
          );

          const moderationResults = await Promise.allSettled(moderationPromises);

          const violatedImages = moderationResults
            .filter((r) => r.status === "fulfilled" && r.value.label !== "normal")
            .map((r) => r.value);

          const hasViolation = violatedImages.length > 0;
          const violationType = hasViolation ? violatedImages[0].label : "normal";

          const update = hasViolation
            ? {
                moderation_status: violationType,
                is_deleted: true,
                moderation_details: {
                  total_images: images.length,
                  violation_count: violatedImages.length,
                  results: moderationResults.map((r) => (r.status === "fulfilled" ? r.value : null)),
                },
              }
            : {
                moderation_status: "normal",
                moderation_details: {
                  total_images: images.length,
                  violation_count: 0,
                  results: moderationResults.map((r) => (r.status === "fulfilled" ? r.value : null)),
                },
              };

          const post = await postModel.findByIdAndUpdate(postId, update);

          if (hasViolation) {
            try {
              const io = getSocketIO();
              const notificationsNamespace = io.of("/notifications");
              const notificationUserSocketMap = getNotificationUserSocketMap();

              await notificationService.createNotificationWithNamespace(
                notificationsNamespace,
                post.user_id.toString(),
                "system",
                `Your post has been blocked due to policy violation.`,
                notificationUserSocketMap,
                { fromUser: null, relatedId: postId }
              );
            } catch (notifyErr) {
              console.error("Error sending notification:", notifyErr);
            }

            const moderationPosts = await postModel.countDocuments({
              user_id: post.user_id,
              moderation_status: { $ne: "normal" },
            });

            if (moderationPosts > 5) {
              await userModel.findByIdAndUpdate(post.user_id, { is_blocked: true });
            }
          }

          console.log(`[MODERATION] Post ${postId}: ${hasViolation}`);

          return {
            postId,
            totalImages: images.length,
            hasViolation,
            violationType,
            results: moderationResults.map((r) => (r.status === "fulfilled" ? r.value : null)),
          };
        } catch (error) {
          console.error(`Error processing post ${postId}:`, error);
          await postModel.findByIdAndUpdate(postId, {
            moderation_status: "error",
            moderation_error: error.message,
          });
          throw error;
        }
      } else {
        console.warn(`Unknown job name: ${job.name}`);
      }
    } catch (error) {
      console.error(`Error in moderation job [${job.name}]:`, error);
      throw error;
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
