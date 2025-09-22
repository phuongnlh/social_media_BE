const mongoose = require("mongoose");
const mongoosePaginate = require('mongoose-paginate-v2');

const AdsSchema = new mongoose.Schema({

  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  campaign_name: { type: String, required: true, trim: true },

  target_location: { type: [String], required: true },
  target_age: {
    type: new mongoose.Schema({
      min: { type: Number, required: true },
      max: { type: Number, required: true },
    }, { _id: false }),
    required: true,
    validate: {
      validator: function (value) {
        return value.min <= value.max;
      },
      message: "Min age must be less than or equal to max age",
    },
  },
  target_gender: { type: [String], enum: ['male', 'female', 'other'], required: true },

  // View-based fields instead of time-based
  target_views: { type: Number, required: true, min: 1 }, // Số view mục tiêu
  current_views: { type: Number, default: 0, min: 0 }, // Số view hiện tại
  started_at: { type: Date }, // Khi nào ads bắt đầu chạy
  completed_at: { type: Date }, // Khi nào ads hoàn thành

  status: {
    type: String,
    //waiting_payment: Tạo QC chờ thanh toán
    //pending_review: Đã thanh toán, chờ duyệt nội dung/chính sách
    //active: Đang chạy (chưa đạt target_views)
    //paused: Tạm dừng thủ công
    //completed: Hoàn thành (đã đạt target_views hoặc hết thời gian max)
    //payment_failed: Thanh toán thất bại
    //canceled: người dùng hủy checkout hoặc session hết hạn
    enum: ['active', 'paused', 'completed', 'waiting_payment', 'pending_review', 'payment_failed', 'canceled', 'deleted'],
    default: 'waiting_payment', required: true, index: true
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

AdsSchema.index({ user_id: 1, status: 1 });
AdsSchema.index({ user_id: 1, created_at: -1 });
AdsSchema.index({ status: 1, created_at: -1 });


AdsSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Ads', AdsSchema);