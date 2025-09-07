const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const PaymentSchema = new Schema({
  user_id: { type: Types.ObjectId, ref: 'User', required: true },
  ads_id:  { type: Types.ObjectId, ref: 'Ads' },

  // Thông tin chung
  method:   { type: String, enum: ['stripe', 'momo', 'mock'], required: true }, // mock vẫn để dành nếu cần
  amount:   { type: Number, required: true, min: 0 }, // minor units: VND=đồng, USD=cents
  currency: { type: String, default: 'VND' },
  status:   { type: String, enum: ['pending', 'paid', 'failed', 'canceled'], default: 'pending', index: true },

  // Stripe
  stripe_payment_intent_id:   { type: String, index: true, unique: true, sparse: true }, // pi_*
  stripe_checkout_session_id: { type: String, index: true, unique: true, sparse: true }, // cs_*

  // MoMo
  momo_transaction_id:     { type: String, index: true, unique: true, sparse: true },
  momo_payment_request_id: { type: String, index: true }, // orderId/requestId

  // Chung
  transaction_id: { type: String }, // mã giao dịch nội bộ
  note:           { type: String },

  completed_at: { type: Date }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

PaymentSchema.index({ user_id: 1, created_at: -1 });

module.exports = mongoose.model('Payment', PaymentSchema);
