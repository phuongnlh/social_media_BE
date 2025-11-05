const admin = require( "../config/firebase");

/**
 * Gửi thông báo FCM đến 1 hoặc nhiều thiết bị
 * @param {string|string[]} tokens - token hoặc mảng token
 * @param {string} title - tiêu đề thông báo
 * @param {string} body - nội dung thông báo
 * @param {object} data - payload kèm theo (tùy chọn)
 * @returns {Promise<void>}
 */
const sendFcmNotification = async (tokens, title, body, data = {}) => {
  if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
    console.warn("⚠️ Không có token để gửi FCM");
    return;
  }

  try {
    const stringData = Object.entries(data).reduce((acc, [key, value]) => {
      acc[key] = String(value); // FCM chỉ chấp nhận string trong data
      return acc;
    }, {});
    const payload = {
      notification: { title, body },
      data: {
        ...stringData,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      android: { priority: "high" },
      apns: { payload: { aps: { contentAvailable: true } } },
    };

    // Nếu nhiều token → dùng sendMulticast
    if (Array.isArray(tokens)) {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        ...payload,
      });
      console.log(`📤 Đã gửi FCM tới ${response.successCount}/${tokens.length} thiết bị`);
    } else {
      const response = await admin.messaging().send({
        token: tokens,
        ...payload,
      });
      console.log("📩 Gửi FCM thành công:", response);
    }
  } catch (error) {
    console.error("❌ Lỗi gửi FCM:", error.message);
  }
};

module.exports = { sendFcmNotification };