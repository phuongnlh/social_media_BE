const mongoose = require("mongoose");
const Stripe = require("stripe");
const crypto = require("crypto");
const https = require("https");
const Ads = require("../models/Payment_Ads/ads.model");
const Payment = require("../models/Payment_Ads/payment.model");
const Activity = require("../models/Payment_Ads/activity-ads.model");

const stripe = new Stripe(process.env.STRIPE_TEST_SK);

// MoMo configuration
const MOMO_CONFIG = {
  partnerCode: 'MOMO',
  accessKey: process.env.MOMO_ACCESS_KEY,
  secretKey: process.env.MOMO_SECRET_KEY,
  endpoint: process.env.MOMO_ENDPOINT,
  requestType: "captureWallet",
  lang: 'vi'
};

// Create checkout session cho ads (support both Stripe and MoMo)
const createCheckoutSession = async (req, res) => {
  try {
    const { adsId, amount, paymentMethod = 'stripe' } = req.body;
    const user_id = req.user._id;

    if (!adsId || !amount) {
      return res.status(400).json({
        success: false,
        message: "adsId and amount are required"
      });
    }

    if (!['stripe', 'momo'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Payment method must be 'stripe' or 'momo'"
      });
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive integer (in cents for Stripe, VND for MoMo)"
      });
    }

    const ads = await Ads.findById(adsId);
    if (!ads) {
      return res.status(404).json({
        success: false,
        message: "Ads not found"
      });
    }

    if (ads.user_id.toString() !== user_id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to pay for this ad"
      });
    }

    if (ads.status !== "waiting_payment") {
      return res.status(409).json({
        success: false,
        message: `Invalid status: ${ads.status}. Can only pay for ads with waiting_payment status.`
      });
    }

    // Create payment record
    const payment = new Payment({
      user_id: user_id,
      ads_id: adsId,
      method: paymentMethod,
      amount: amount,
      currency: paymentMethod === 'stripe' ? 'USD' : 'VND',
      status: 'pending'
    });
    const savedPayment = await payment.save();

    try {
      if (paymentMethod === 'stripe') {
        return await createStripeSession(req, res, ads, savedPayment, amount);
      } else if (paymentMethod === 'momo') {
        return await createMoMoSession(req, res, ads, savedPayment, amount);
      }
    } catch (error) {
      // Revert changes if payment session creation fails
      await Payment.findByIdAndDelete(savedPayment._id);
      throw error;
    }

  } catch (error) {
    console.error("Error creating checkout session:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create checkout session",
      error: error.message
    });
  }
};

// Create Stripe session
const createStripeSession = async (req, res, ads, payment, amount) => {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Ad Campaign: ${ads.campaign_name}`,
            description: `Advertising campaign for ${ads.target_views} views targeting ${ads.target_location}, ${ads.target_age}, ${ads.target_gender}`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      adsId: String(ads._id),
      userId: String(ads.user_id),
      paymentId: String(payment._id)
    },
    success_url: `${process.env.FRONTEND_URL}/ads/payment/success?session_id={CHECKOUT_SESSION_ID}&method=stripe`,
    cancel_url: `${process.env.FRONTEND_URL}/ads/payment/cancel?ads_id=${ads._id}&method=stripe`,
    expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
  });

  // Update payment record with Stripe session info
  await Payment.findByIdAndUpdate(payment._id, {
    stripe_checkout_session_id: session.id,
    paylink: session.url
  });

  return res.status(200).json({
    success: true,
    message: "Stripe checkout session created successfully",
    data: {
      url: session.url,
      session_id: session.id,
      payment_id: payment._id,
      method: 'stripe'
    }
  });
};

// Create MoMo session
const createMoMoSession = async (req, res, ads, payment, amount) => {
  try {
    // Validate MoMo config
    if (!MOMO_CONFIG.accessKey || !MOMO_CONFIG.secretKey) {
      throw new Error('MoMo credentials not configured');
    }

    const orderId = MOMO_CONFIG.partnerCode + new Date().getTime();
    const requestId = orderId;
    const orderInfo = `Ad Campaign: ${ads.campaign_name}`;
    const redirectUrl = `${process.env.FRONTEND_URL}/ads/payment/result?order_id=${orderId}&method=momo`;
    const ipnUrl = `${process.env.BACKEND_URL}/api/v1/payment/momo/webhook`;
    const extraData = Buffer.from(JSON.stringify({
      adsId: String(ads._id),
      userId: String(ads.user_id),
      paymentId: String(payment._id)
    })).toString('base64');

    // Create signature
    const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${MOMO_CONFIG.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${MOMO_CONFIG.requestType}`;

    const signature = crypto.createHmac('sha256', MOMO_CONFIG.secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody = JSON.stringify({
      partnerCode: MOMO_CONFIG.partnerCode,
      partnerName: "Social Media App",
      storeId: "SocialMediaStore",
      requestId: requestId,
      amount: amount,
      orderId: orderId,
      orderInfo: orderInfo,
      redirectUrl: redirectUrl,
      ipnUrl: ipnUrl,
      lang: MOMO_CONFIG.lang,
      requestType: MOMO_CONFIG.requestType,
      autoCapture: true,
      extraData: extraData,
      signature: signature,
    });
    // Make request to MoMo
    const momoResponse = await makeMoMoRequest(requestBody);

    if (momoResponse.resultCode === 0) {
      // Update payment record with MoMo info
      await Payment.findByIdAndUpdate(payment._id, {
        momo_transaction_id: orderId,
        momo_payment_request_id: requestId,
        paylink: momoResponse.payUrl
      });

      return res.status(200).json({
        success: true,
        message: "MoMo checkout session created successfully",
        data: {
          url: momoResponse.payUrl,
          order_id: orderId,
          payment_id: payment._id,
          method: 'momo',
        }
      });
    } else {
      console.error('MoMo API Error:', momoResponse);
      throw new Error(`MoMo API Error (${momoResponse.resultCode}): ${momoResponse.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error creating MoMo session:', error);
    throw error;
  }
};

// Helper function to make MoMo API request
const makeMoMoRequest = (requestBody) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'test-payment.momo.vn',
      port: 443,
      path: '/v2/gateway/api/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, res => {
      let body = '';
      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (error) {
          reject(new Error('Invalid JSON response from MoMo'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(requestBody);
    req.end();
  });
};

// Handle MoMo webhook/IPN
const handleMoMoWebhook = async (req, res) => {

  try {
    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    } = req.body;
    // Verify signature
    const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    const expectedSignature = crypto.createHmac('sha256', MOMO_CONFIG.secretKey)
      .update(rawSignature)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid MoMo webhook signature');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    // Parse extraData
    let metadata;
    try {
      metadata = JSON.parse(Buffer.from(extraData, 'base64').toString());
    } catch (error) {
      console.error('Error parsing MoMo extraData:', error);
      return res.status(400).json({ message: 'Invalid extraData' });
    }

    const { adsId, paymentId } = metadata;

    if (resultCode === 0) {
      // Payment successful
      await handleSuccessfulMoMoPayment(adsId, paymentId, transId);
    } else {
      // Payment failed
      await handleFailedMoMoPayment(adsId, paymentId);
    }

    res.status(200).json({ message: 'OK' });

  } catch (error) {
    console.error('Error handling MoMo webhook:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Handle successful MoMo payment
const handleSuccessfulMoMoPayment = async (adsId, paymentId, transactionId) => {
  try {
    const ad = await Ads.findById(adsId);
    if (!ad) {
      console.error(`Ad not found: ${adsId}`);
      return;
    }
    // Update payment status
    const updatedPayment = await Payment.findByIdAndUpdate(paymentId, {
      status: 'paid',
      momo_transaction_id: transactionId,
      completed_at: new Date()
    }, { new: true });

    // Activate ads
    const updatedAd = await Ads.findByIdAndUpdate(adsId, {
      status: 'active',
      started_at: new Date()
    }, { new: true });

    await Activity.create({
      user_id: ad.user_id,
      ads_id: ad._id,
      type: 'campaign_started',
      metadata: {
        campaign_name: ad.campaign_name
      }
    });
  } catch (error) {
    console.error(`Error updating ad status after MoMo payment:`, error);
  }
};

// Handle failed MoMo payment
const handleFailedMoMoPayment = async (adsId, paymentId) => {
  try {
    await Payment.findByIdAndUpdate(paymentId, {
      status: 'canceled'
    });

    // Set ads status to canceled instead of deleting
    await Ads.findByIdAndUpdate(adsId, {
      status: 'canceled'
    });
  } catch (error) {
    console.error(`Error handling canceled MoMo payment:`, error);
  }
};

const verifyPaymentSuccess = async (req, res) => {
  try {
    const { session_id, order_id, method } = req.query;
    const user_id = req.user._id;

    if (method === 'stripe') {
      return await verifyStripePayment(req, res, session_id, user_id);
    } else if (method === 'momo') {
      return await verifyMoMoPayment(req, res, order_id, user_id);
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method"
      });
    }

  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message
    });
  }
};

// Verify Stripe payment
const verifyStripePayment = async (req, res, session_id, user_id) => {
  if (!session_id) {
    return res.status(400).json({
      success: false,
      message: "Session ID is required"
    });
  }

  const session = await stripe.checkout.sessions.retrieve(session_id);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "Session not found"
    });
  }

  if (session.metadata.userId !== user_id.toString()) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized"
    });
  }

  const ads = await Ads.findById(session.metadata.adsId);
  const payment = await Payment.findById(session.metadata.paymentId);

  return res.status(200).json({
    success: true,
    message: "Stripe payment verified successfully",
    data: {
      session_status: session.payment_status,
      ads: ads,
      payment: payment,
      method: 'stripe'
    }
  });
};

// Verify MoMo payment
const verifyMoMoPayment = async (req, res, order_id, user_id) => {
  if (!order_id) {
    return res.status(400).json({
      success: false,
      message: "Order ID is required"
    });
  }

  const payment = await Payment.findOne({
    momo_payment_request_id: order_id
  }).populate('ads_id');

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: "Payment not found"
    });
  }

  if (payment.user_id.toString() !== user_id.toString()) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized"
    });
  }

  return res.status(200).json({
    success: true,
    message: "MoMo payment verified successfully",
    data: {
      payment_status: payment.status,
      ads: payment.ads_id,
      payment: payment,
      method: 'momo'
    }
  });
};

// Handle payment cancel function
const handlePaymentCancel = async (req, res) => {
  try {
    const { ads_id, method } = req.body;
    const user_id = req.user._id;

    if (!ads_id) {
      return res.status(400).json({
        success: false,
        message: "ads_id is required"
      });
    }

    const ads = await Ads.findById(ads_id);
    if (!ads) {
      return res.status(404).json({
        success: false,
        message: "Ad not found"
      });
    }

    if (ads.user_id.toString() !== user_id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Check if ads is already canceled
    if (ads.status === 'canceled') {
      return res.status(200).json({
        success: true,
        message: "Ad is already canceled"
      });
    }

    if (ads.status !== 'waiting_payment') {
      return res.status(409).json({
        success: false,
        message: `Cannot cancel ad with status: ${ads.status}`
      });
    }

    // Update payment status to canceled
    await Payment.updateOne(
      { ads_id: ads_id, status: 'pending' },
      { status: 'canceled' }
    );

    // Set ads status to canceled
    await Ads.findByIdAndUpdate(ads_id, {
      status: 'canceled'
    });

    return res.status(200).json({
      success: true,
      message: `${method || 'Payment'} canceled and ad status set to canceled successfully`
    });

  } catch (error) {
    console.error("Error handling payment cancel:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to handle payment cancel",
      error: error.message
    });
  }
};

// Existing Stripe webhook handler
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

const handleSuccessfulPayment = async (session) => {
  try {
    const { adsId, paymentId } = session.metadata;

    const ad = await Ads.findById(adsId);
    if (!ad) {
      console.error(`Ad not found: ${adsId}`);
      return;
    }

    await Payment.findByIdAndUpdate(paymentId, {
      status: 'paid',
      stripe_payment_intent_id: session.payment_intent,
      completed_at: new Date()
    });

    const updates = {
      status: 'active',
      started_at: new Date()
    };

    await Ads.findByIdAndUpdate(adsId, updates);
    await Activity.create({
      user_id: ad.user_id,
      ads_id: ad._id,
      type: 'campaign_started',
      metadata: {
        campaign_name: ad.campaign_name
      }
    });

  } catch (error) {
    console.error(`Error updating ad status after payment:`, error);
  }
};

const handleExpiredSession = async (session) => {
  try {
    const { adsId, paymentId } = session.metadata;

    if (paymentId) {
      await Payment.findByIdAndUpdate(paymentId, {
        status: 'canceled'
      });
    }

    await Ads.findByIdAndUpdate(adsId, {
      status: 'canceled'
    });

  } catch (error) {
    console.error(`Error setting ad status to canceled after session expiry:`, error);
  }
};

const handleFailedPayment = async (paymentIntent) => {
  try {
    const payment = await Payment.findOne({
      stripe_payment_intent_id: paymentIntent.id
    });

    if (payment) {
      await Payment.findByIdAndUpdate(payment._id, {
        status: 'failed'
      });

      await Ads.findByIdAndUpdate(payment.ads_id, {
        status: 'payment_failed'
      });

    }
  } catch (error) {
    console.error(`Error handling failed payment:`, error);
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
      .populate('ads_id', 'campaign_name target_location target_age target_gender target_views current_views')
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

// Query MoMo payment status
const queryMoMoPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const user_id = req.user._id;

    // Find payment record
    const payment = await Payment.findOne({
      momo_payment_request_id: orderId,
      user_id: user_id
    }).populate('ads_id');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    // Create query signature
    const requestId = orderId;
    const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&orderId=${orderId}&partnerCode=${MOMO_CONFIG.partnerCode}&requestId=${requestId}`;
    
    const signature = crypto.createHmac('sha256', MOMO_CONFIG.secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody = JSON.stringify({
      partnerCode: MOMO_CONFIG.partnerCode,
      requestId: requestId,
      orderId: orderId,
      signature: signature,
      lang: MOMO_CONFIG.lang
    });

    // Query MoMo API
    const momoResponse = await queryMoMoTransaction(requestBody);

    return res.status(200).json({
      success: true,
      message: "MoMo payment status retrieved successfully",
      data: {
        orderId: orderId,
        resultCode: momoResponse.resultCode,
        message: momoResponse.message,
        transId: momoResponse.transId,
        amount: momoResponse.amount,
        payment: payment,
        ads: payment.ads_id
      }
    });

  } catch (error) {
    console.error("Error querying MoMo payment status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to query payment status",
      error: error.message
    });
  }
};

// Helper function to query MoMo transaction
const queryMoMoTransaction = (requestBody) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'test-payment.momo.vn',
      port: 443,
      path: '/v2/gateway/api/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, res => {
      let body = '';
      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (error) {
          reject(new Error('Invalid JSON response from MoMo Query API'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(requestBody);
    req.end();
  });
};

//Cancel MoMo payment
const cancelMoMoPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const user_id = req.user._id;

    // Find payment record
    const payment = await Payment.findOne({
      momo_payment_request_id: orderId,
      user_id: user_id
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    // Create cancel signature
    const requestId = `cancel_${orderId}_${Date.now()}`;
    const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&orderId=${orderId}&partnerCode=${MOMO_CONFIG.partnerCode}&requestId=${requestId}`;
    
    const signature = crypto.createHmac('sha256', MOMO_CONFIG.secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody = JSON.stringify({
      partnerCode: MOMO_CONFIG.partnerCode,
      requestId: requestId,
      orderId: orderId,
      signature: signature,
      lang: MOMO_CONFIG.lang
    });

    // Call MoMo cancel API
    const cancelResponse = await cancelMoMoTransaction(requestBody);

    // Update local payment status
    await Payment.findByIdAndUpdate(payment._id, {
      status: 'canceled',
      canceled_at: new Date()
    });

    return res.status(200).json({
      success: true,
      message: "Payment canceled successfully",
      data: cancelResponse
    });

  } catch (error) {
    console.error("Error canceling MoMo payment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel payment",
      error: error.message
    });
  }
};

// Helper function to cancel MoMo transaction
const cancelMoMoTransaction = (requestBody) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'test-payment.momo.vn',
      port: 443,
      path: '/v2/gateway/api/cancel', // Cancel endpoint
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, res => {
      let body = '';
      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (error) {
          reject(new Error('Invalid JSON response from MoMo Cancel API'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(requestBody);
    req.end();
  });
};

module.exports = {
  createCheckoutSession,
  handleWebhook,
  handleMoMoWebhook,
  verifyPaymentSuccess,
  getPaymentHistory,
  handlePaymentCancel,
  queryMoMoPaymentStatus,
  cancelMoMoPayment
};