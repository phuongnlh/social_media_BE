const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const ActivitySchema = new Schema({
    user_id: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    ads_id: { type: Types.ObjectId, ref: 'Ads', required: true, index: true },

    type: {
        type: String,
        enum: [
            'campaign_started',      // Bắt đầu chạy
            'campaign_paused',       // Tạm dừng
            'campaign_resumed',      // Tiếp tục
            'campaign_completed',    // Hoàn thành
            'campaign_deleted',      // Bị xóa
            'campaign_rejected',     // Bị từ chối
            'campaign_violated',     // Vi phạm chính sách
            'progress_25',           // Đạt 25% views
            'progress_50',           // Đạt 50% views
            'progress_75',           // Đạt 75% views
        ],
        required: true,
        index: true
    },

    // Metadata tùy theo type
    metadata: {
        campaign_name: String,
        progress_percent: Number,
        views_count: Number,
        reason: String  // lý do reject/violate
    },

    created_at: { type: Date, default: Date.now, index: true }
}, {
    timestamps: false
});

ActivitySchema.index({ user_id: 1, created_at: -1 });
ActivitySchema.index({ ads_id: 1, created_at: -1 });

module.exports = mongoose.model('Activity', ActivitySchema);
