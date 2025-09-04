const mongoose = require("mongoose");
const Stripe = require("stripe");
const Ads = require("../models/Payment_Ads/ads.model");
const Payment = require("../models/Payment_Ads/payment.model");

const stripe = new Stripe(process.env.STRIPE_TEST_SK);

// Tạo checkout session cho ads
const createCheckoutSession = async (req, res) => {
  try {
    const { adsId, amount } = req.body; // amount in cents (VD: 2000 = $20.00)
    const user_id = req.user._id;

    if (!adsId || !amount) {
      return res.status(400).json({ 
        success: false,
        message: "adsId and amount are required" 
      });
    }

    // Validate amount
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive integer (in cents)"
      });
    }

    const ads = await Ads.findById(adsId);
    if (!ads) {
      return res.status(404).json({ 
        success: false,
        message: "Ads not found" 
      });
    }

    // Check if user owns this ad
    if (ads.user_id.toString() !== user_id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to pay for this ad"
      });
    }

    // Check if ad is in correct status for payment
    if (ads.status !== "waiting_payment") {
      return res.status(409).json({ 
        success: false,
        message: `Invalid status: ${ads.status}. Can only pay for ads with waiting_payment status.` 
      });
    }

    // Update ad status to payment_processing
    await Ads.findByIdAndUpdate(adsId, { 
      status: 'payment_processing' 
    });

    // Create payment record
    const payment = new Payment({
      user_id: user_id,
      ads_id: adsId,
      method: 'stripe',
      amount: amount,
      currency: 'USD',
      status: 'pending'
    });
    const savedPayment = await payment.save();

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Ad Campaign: ${ads.campaign_name}`,
              description: `Advertising campaign targeting ${ads.target_location}, ${ads.target_age}, ${ads.target_gender}`,
              images: [], // Có thể thêm hình ảnh post vào đây
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        adsId: String(ads._id),
        userId: String(ads.user_id),
        paymentId: String(savedPayment._id)
      },
      success_url: `${process.env.FRONTEND_URL}/ads/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/ads/payment/cancel?ads_id=${adsId}`,
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
    });

    // Update payment record with Stripe session info
    await Payment.findByIdAndUpdate(savedPayment._id, {
      stripe_checkout_session_id: session.id
    });

    return res.status(200).json({ 
      success: true,
      message: "Checkout session created successfully",
      data: {
        url: session.url,
        session_id: session.id,
        payment_id: savedPayment._id
      }
    });

  } catch (error) {
    console.error("Error creating checkout session:", error);
    
    // Revert ad status back to waiting_payment if there was an error
    if (req.body.adsId) {
      try {
        await Ads.findByIdAndUpdate(req.body.adsId, { 
          status: 'waiting_payment' 
        });
      } catch (revertError) {
        console.error("Error reverting ad status:", revertError);
      }
    }

    return res.status(500).json({ 
      success: false,
      message: "Failed to create checkout session",
      error: error.message 
    });
  }
};

// Xử lý webhook từ Stripe
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleSuccessfulPayment(event.data.object);
      break;

    case 'checkout.session.expired':
      await handleExpiredSession(event.data.object);
      break;

    case 'payment_intent.payment_failed':
      await handleFailedPayment(event.data.object);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

// Xử lý thanh toán thành công
const handleSuccessfulPayment = async (session) => {
  try {
    const { adsId, paymentId } = session.metadata;

    // Update payment status
    await Payment.findByIdAndUpdate(paymentId, {
      status: 'paid',
      stripe_payment_intent_id: session.payment_intent,
      completed_at: new Date()
    });

    // Update ad status to pending_review after successful payment
    await Ads.findByIdAndUpdate(adsId, {
      status: 'pending_review'
    });
    
    console.log(`Payment successful for ads: ${adsId}`);
  } catch (error) {
    console.error(`Error updating ad status after payment:`, error);
  }
};

// Xử lý session hết hạn
const handleExpiredSession = async (session) => {
  try {
    const { adsId, paymentId } = session.metadata;

    // Update payment status
    if (paymentId) {
      await Payment.findByIdAndUpdate(paymentId, {
        status: 'canceled'
      });
    }

    // Revert ad status to waiting_payment if session expired
    await Ads.findByIdAndUpdate(adsId, {
      status: 'canceled'
    });
    
    console.log(`Payment session expired for ads: ${adsId}`);
  } catch (error) {
    console.error(`Error reverting ad status after session expiry:`, error);
  }
};

// Xử lý thanh toán thất bại
const handleFailedPayment = async (paymentIntent) => {
  try {
    // Tìm payment record bằng payment_intent_id
    const payment = await Payment.findOne({
      stripe_payment_intent_id: paymentIntent.id
    });

    if (payment) {
      // Update payment status
      await Payment.findByIdAndUpdate(payment._id, {
        status: 'failed'
      });

      // Update ad status
      await Ads.findByIdAndUpdate(payment.ads_id, {
        status: 'payment_failed'
      });
      
      console.log(`Payment failed for ads: ${payment.ads_id}`);
    }
  } catch (error) {
    console.error(`Error handling failed payment:`, error);
  }
};

// Verify payment success (được gọi từ success page)
const verifyPaymentSuccess = async (req, res) => {
  try {
    const { session_id } = req.query;
    const user_id = req.user._id;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required"
      });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found"
      });
    }

    // Verify user owns this session
    if (session.metadata.userId !== user_id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Get ad and payment info
    const ads = await Ads.findById(session.metadata.adsId);
    const payment = await Payment.findById(session.metadata.paymentId);

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: {
        session_status: session.payment_status,
        ads: ads,
        payment: payment
      }
    });

  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message
    });
  }
};

// Get payment history for user
const getPaymentHistory = async (req, res) => {
  try {
    const user_id = req.user._id;
    const { page = 1, limit = 10, status } = req.query;

    const filter = { user_id };
    if (status) filter.status = status;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const payments = await Payment.find(filter)
      .populate('ads_id', 'campaign_name target_location target_age target_gender')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalDocs = await Payment.countDocuments(filter);
    const totalPages = Math.ceil(totalDocs / limitNum);

    const paginationData = {
      docs: payments,
      totalDocs,
      limit: limitNum,
      totalPages,
      page: pageNum,
      pagingCounter: skip + 1,
      hasPrevPage: pageNum > 1,
      hasNextPage: pageNum < totalPages,
      prevPage: pageNum > 1 ? pageNum - 1 : null,
      nextPage: pageNum < totalPages ? pageNum + 1 : null
    };

    return res.status(200).json({
      success: true,
      message: "Payment history retrieved successfully",
      data: paginationData
    });

  } catch (error) {
    console.error("Error getting payment history:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while retrieving payment history",
      error: error.message
    });
  }
};

module.exports = {
  createCheckoutSession,
  handleWebhook,
  verifyPaymentSuccess,
  getPaymentHistory
};