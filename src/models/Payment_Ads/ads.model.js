const mongoose = require("mongoose");
const mongoosePaginate = require('mongoose-paginate-v2');

const AdsSchema = new mongoose.Schema({

  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  campaign_name: { type: String, required: true, trim: true },

  target_location: { type: String, required: true },
  target_age: { type: String, required: true },
  target_gender: { type: String, enum: ['male', 'female', 'other'], required: true },

  //Time
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },

  status: {
    type: String,
    //waiting_payment: Tạo QC chờ thanh toán
    //payment_processing: Đang xử lý thanh toán
    //pending_review: Đã thanh toán, chờ duyệt nội dung/chính sách
    //scheduled: Đã duyệt, đợi đến start_date mới chạy
    //active: Đang chạy
    //paused: Tạm dừng thủ công hoặc do lỗi tạm thời.
    //completed: Kết thúc (đã chạy hết thời gian hoặc hết ngân sách)
    //payment_failed: Thanh toán thất bại
    //canceled: người dùng hủy checkout (explicit) hoặc session hết hạn bạn quy về hủy.
    enum: ['active', 'paused', 'completed', 'waiting_payment', 'pending_review', 'scheduled', 'payment_processing', 'payment_failed', 'canceled'],
    default: 'waiting_payment', required: true, index: true
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

AdsSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Ads', AdsSchema);
