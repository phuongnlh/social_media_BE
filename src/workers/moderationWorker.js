const { Worker } = require("bullmq");
const Comment = require("../models/Comment_Reaction/comment.model");
const grpcClient = require("../services/grpcClient");
const { redisConfig } = require("../config/database.redis");
const postModel = require("../models/post.model");
const userModel = require("../models/user.model");
const {
  getSocketIO,
  getNotificationUserSocketMap,
} = require("../socket/io-instance");
const notificationService = require("../services/notification.service");
const moderationWorker = new Worker(
  "moderation",
  async (job) => {
    try {
      if (job.name === "checkImageComment") {
        const { commentId, url, mediaType } = job.data;

        return new Promise((resolve, reject) => {
          grpcClient.CheckImage(
            { base_url: url, media_type: mediaType },
            async (err, response) => {
              try {
                if (err) {
                  console.error("gRPC CheckImage error:", err);
                  return reject(err);
                }
                let update;
                // update DB với kết quả
                if (response.label !== "normal") {
                  update = {
                    moderation_status: response.label,
                    is_deleted: true,
                  };
                } else {
                  update = { moderation_status: response.label };
                }
                const comment = await Comment.findByIdAndUpdate(
                  commentId,
                  update,
                  { new: true }
                );
                if (response.label !== "normal") {
                  try {
                    const io = getSocketIO();
                    const notificationsNamespace = io.of("/notifications");
                    const notificationUserSocketMap =
                      getNotificationUserSocketMap();

                    await notificationService.createNotificationWithNamespace(
                      notificationsNamespace,
                      comment.user_id.toString(),
                      "system",
                      `Your comment has been blocked due to policy violation.`,
                      notificationUserSocketMap,
                      {
                        fromUser: null,
                        relatedId: comment.postgr_id || comment.post_id,
                      }
                    );
                  } catch (notifyErr) {
                    console.error("Error sending notification:", notifyErr);
                    // Tiếp tục thực thi ngay cả khi gửi thông báo thất bại
                  }
                }
                console.log(
                  `[MODERATION] Comment ${commentId}: ${response.label}`
                );

                resolve(response);
              } catch (error) {
                console.error("Error in gRPC callback:", error);
                reject(error);
              }
            }
          );
        });
      } else if (job.name === "checkImagePost") {
        const { postId, url, mediaType } = job.data;

        return new Promise((resolve, reject) => {
          grpcClient.CheckImage(
            { base_url: url, media_type: mediaType },
            async (err, response) => {
              if (err) {
                console.error("gRPC CheckImage error:", err);
                return reject(err);
              }

              let update;
              // update DB với kết quả
              if (response.label === "normal") {
                update = { moderation_status: response.label };
              } else {
                update = {
                  moderation_status: response.label,
                  is_deleted: true,
                };
              }

              const post = await postModel.findByIdAndUpdate(postId, update, {
                new: true,
              });
              if (response.label !== "normal") {
                try {
                  const io = getSocketIO();
                  const notificationsNamespace = io.of("/notifications");
                  const notificationUserSocketMap =
                    getNotificationUserSocketMap();

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
                  // Tiếp tục thực thi ngay cả khi gửi thông báo thất bại
                }
                const moderationPosts = await postModel.countDocuments({
                  user_id: post.user_id,
                  moderation_status: { $ne: "normal" },
                });
                if (moderationPosts > 5) {
                  await userModel.findByIdAndUpdate(post.user_id, {
                    is_blocked: true,
                  });
                }
              }
              console.log(`[MODERATION] Post ${postId}: ${response.label}`);
              resolve(response);
            }
          );
        });
      } else if (job.name === "checkPostMultipleImages") {
        const { postId, images } = job.data;

        try {
          console.log(
            `Processing post ${postId} with ${images.length} images (PARALLEL)`
          );

          // Process all images in parallel
          const moderationPromises = images.map((image, index) => {
            return new Promise((resolve, reject) => {
              grpcClient.CheckImage(
                { base_url: image.url, media_type: image.mediaType },
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
          const violationType = hasViolation
            ? violatedImages[0].label
            : "normal";

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
              // Tiếp tục thực thi ngay cả khi gửi thông báo thất bại
            }
            const moderationPosts = await postModel.count({
              user_id: post.user_id,
              moderation_status: { $ne: "normal" },
            });
            if (moderationPosts > 5) {
              await userModel.findByIdAndUpdate(post.user_id, {
                is_blocked: true,
              });
            }
          }

          console.log(`[MODERATION] Post ${postId}: ${hasViolation}`);

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
