process.env.STRIPE_TEST_SK = 'sk_test_mock_key';
process.env.MOMO_ACCESS_KEY = 'mock_access_key';
process.env.MOMO_SECRET_KEY = 'mock_secret_key';
process.env.MOMO_ENDPOINT = 'https://test-payment.momo.vn';
const request = require('supertest');
const express = require('express');
const router = require('../routes/payment.route');
const paymentController = require('../controllers/payment.controller');
const { isLogin } = require('../middlewares/auth');

const app = express();
app.use(express.json());
app.use('/payment', router);

jest.mock('../controllers/payment.controller');

// Mock the auth middleware
jest.mock('../middlewares/auth', () => ({
  isLogin: jest.fn((req, res, next) => {
    req.user = { 
      _id: 'mockUserId123',
      id: 'mockUserId123',
      fullName: 'John Doe',
      avatar_url: 'https://example.com/avatar.jpg'
    };
    next();
  })
}));

describe('Payment Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== CREATE CHECKOUT SESSION ====================
  describe('Create Checkout Session --- POST /payment/checkout', () => {
    it('should create Stripe checkout session successfully', async () => {
      paymentController.createCheckoutSession.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: "Stripe checkout session created successfully",
          data: {
            url: 'https://checkout.stripe.com/pay/cs_test_abc123',
            session_id: 'cs_test_abc123',
            payment_id: 'payment123',
            method: 'stripe'
          }
        });
      });

      const response = await request(app)
        .post('/payment/checkout')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          adsId: 'ads123',
          amount: 5000, // $50.00 in cents
          paymentMethod: 'stripe'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Stripe checkout session created successfully');
      expect(response.body.data).toHaveProperty('url');
      expect(response.body.data).toHaveProperty('session_id');
      expect(response.body.data.method).toBe('stripe');
      expect(paymentController.createCheckoutSession).toHaveBeenCalledTimes(1);
    });

    it('should create MoMo checkout session successfully', async () => {
      paymentController.createCheckoutSession.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: "MoMo checkout session created successfully",
          data: {
            url: 'https://test-payment.momo.vn/pay/abc123',
            order_id: 'MOMOJGOI20250919_TEST1729876543210',
            payment_id: 'payment456',
            method: 'momo'
          }
        });
      });

      const response = await request(app)
        .post('/payment/checkout')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          adsId: 'ads456',
          amount: 100000, // 100,000 VND
          paymentMethod: 'momo'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('MoMo checkout session created successfully');
      expect(response.body.data.method).toBe('momo');
      expect(response.body.data).toHaveProperty('order_id');
      expect(paymentController.createCheckoutSession).toHaveBeenCalledTimes(1);
    });

    it('should create checkout for different ad campaigns successfully', async () => {
      paymentController.createCheckoutSession.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: "Stripe checkout session created successfully",
          data: {
            url: 'https://checkout.stripe.com/pay/cs_test_campaign',
            session_id: 'cs_test_campaign',
            payment_id: 'payment_campaign',
            method: 'stripe'
          }
        });
      });

      const response = await request(app)
        .post('/payment/checkout')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          adsId: 'ads_campaign_123',
          amount: 10000,
          paymentMethod: 'stripe'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(paymentController.createCheckoutSession).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== VERIFY PAYMENT SUCCESS ====================
  describe('Verify Payment Success --- GET /payment/verify-success', () => {
    it('should verify Stripe payment successfully', async () => {
      paymentController.verifyPaymentSuccess.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: "Stripe payment verified successfully",
          data: {
            session_status: 'paid',
            ads: {
              _id: 'ads123',
              campaign_name: 'Summer Campaign',
              status: 'active',
              target_views: 10000
            },
            payment: {
              _id: 'payment123',
              amount: 5000,
              currency: 'USD',
              status: 'paid',
              method: 'stripe'
            },
            method: 'stripe'
          }
        });
      });

      const response = await request(app)
        .get('/payment/verify-success')
        .set('Authorization', 'Bearer mockToken123')
        .query({ 
          session_id: 'cs_test_abc123',
          method: 'stripe'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Stripe payment verified successfully');
      expect(response.body.data.session_status).toBe('paid');
      expect(response.body.data.method).toBe('stripe');
      expect(paymentController.verifyPaymentSuccess).toHaveBeenCalledTimes(1);
    });

    it('should verify MoMo payment successfully', async () => {
      paymentController.verifyPaymentSuccess.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: "MoMo payment verified successfully",
          data: {
            payment_status: 'paid',
            ads: {
              _id: 'ads456',
              campaign_name: 'Holiday Campaign',
              status: 'active',
              target_views: 20000
            },
            payment: {
              _id: 'payment456',
              amount: 100000,
              currency: 'VND',
              status: 'paid',
              method: 'momo'
            },
            method: 'momo'
          }
        });
      });

      const response = await request(app)
        .get('/payment/verify-success')
        .set('Authorization', 'Bearer mockToken123')
        .query({ 
          order_id: 'MOMOJGOI20250919_TEST1729876543210',
          method: 'momo'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('MoMo payment verified successfully');
      expect(response.body.data.payment_status).toBe('paid');
      expect(response.body.data.method).toBe('momo');
      expect(paymentController.verifyPaymentSuccess).toHaveBeenCalledTimes(1);
    });

    it('should verify payment with activated ad campaign', async () => {
      paymentController.verifyPaymentSuccess.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: "Stripe payment verified successfully",
          data: {
            session_status: 'paid',
            ads: {
              _id: 'ads789',
              campaign_name: 'New Product Launch',
              status: 'active',
              started_at: new Date(),
              target_views: 15000,
              current_views: 0
            },
            payment: {
              _id: 'payment789',
              status: 'paid',
              completed_at: new Date()
            },
            method: 'stripe'
          }
        });
      });

      const response = await request(app)
        .get('/payment/verify-success')
        .set('Authorization', 'Bearer mockToken123')
        .query({ 
          session_id: 'cs_test_verified',
          method: 'stripe'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.ads.status).toBe('active');
      expect(response.body.data.ads).toHaveProperty('started_at');
      expect(paymentController.verifyPaymentSuccess).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== HANDLE PAYMENT CANCEL ====================
  describe('Handle Payment Cancel --- POST /payment/cancel', () => {
    it('should cancel pending Stripe payment successfully', async () => {
      paymentController.handlePaymentCancel.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: "stripe canceled and ad status set to canceled successfully"
        });
      });

      const response = await request(app)
        .post('/payment/cancel')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          ads_id: 'ads123',
          method: 'stripe'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('canceled');
      expect(paymentController.handlePaymentCancel).toHaveBeenCalledTimes(1);
    });

    it('should cancel pending MoMo payment successfully', async () => {
      paymentController.handlePaymentCancel.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: "momo canceled and ad status set to canceled successfully"
        });
      });

      const response = await request(app)
        .post('/payment/cancel')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          ads_id: 'ads456',
          method: 'momo'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(paymentController.handlePaymentCancel).toHaveBeenCalledTimes(1);
    });

    it('should handle already canceled payment gracefully', async () => {
      paymentController.handlePaymentCancel.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: "Ad is already canceled"
        });
      });

      const response = await request(app)
        .post('/payment/cancel')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          ads_id: 'ads789',
          method: 'stripe'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Ad is already canceled');
      expect(paymentController.handlePaymentCancel).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== MOMO SPECIFIC OPERATIONS ====================
  describe('Query MoMo Payment Status --- POST /payment/momo/query/:orderId', () => {
    it('should query MoMo payment status successfully', async () => {
      paymentController.queryMoMoPaymentStatus.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: "MoMo payment status retrieved successfully",
          data: {
            orderId: 'MOMOJGOI20250919_TEST1729876543210',
            resultCode: 0,
            message: 'Successful',
            transId: '123456789',
            amount: 100000,
            payment: {
              _id: 'payment123',
              status: 'paid',
              method: 'momo'
            },
            ads: {
              _id: 'ads123',
              campaign_name: 'Campaign',
              status: 'active'
            }
          }
        });
      });

      const response = await request(app)
        .post('/payment/momo/query/MOMOJGOI20250919_TEST1729876543210')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('MoMo payment status retrieved successfully');
      expect(response.body.data).toHaveProperty('resultCode', 0);
      expect(response.body.data).toHaveProperty('transId');
      expect(paymentController.queryMoMoPaymentStatus).toHaveBeenCalledTimes(1);
    });

    it('should query pending MoMo payment successfully', async () => {
      paymentController.queryMoMoPaymentStatus.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: "MoMo payment status retrieved successfully",
          data: {
            orderId: 'MOMOJGOI20250919_TEST1729999999',
            resultCode: 1000,
            message: 'Transaction is being processed',
            payment: {
              status: 'pending'
            }
          }
        });
      });

      const response = await request(app)
        .post('/payment/momo/query/MOMOJGOI20250919_TEST1729999999')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.data.payment.status).toBe('pending');
      expect(paymentController.queryMoMoPaymentStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cancel MoMo Payment --- POST /payment/momo/cancel/:orderId', () => {
    it('should cancel MoMo payment successfully', async () => {
      paymentController.cancelMoMoPayment.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: "Payment canceled successfully",
          data: {
            resultCode: 0,
            message: 'Successful',
            orderId: 'MOMOJGOI20250919_TEST1729876543210'
          }
        });
      });

      const response = await request(app)
        .post('/payment/momo/cancel/MOMOJGOI20250919_TEST1729876543210')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment canceled successfully');
      expect(paymentController.cancelMoMoPayment).toHaveBeenCalledTimes(1);
    });

    it('should cancel pending MoMo transaction successfully', async () => {
      paymentController.cancelMoMoPayment.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: "Payment canceled successfully",
          data: {
            resultCode: 0,
            message: 'Transaction canceled',
            orderId: 'MOMOJGOI20250919_TEST9999999'
          }
        });
      });

      const response = await request(app)
        .post('/payment/momo/cancel/MOMOJGOI20250919_TEST9999999')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(paymentController.cancelMoMoPayment).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== WEBHOOK HANDLERS ====================
  describe('Stripe Webhook --- POST /payment/stripe/webhook', () => {
    it('should handle checkout.session.completed event successfully', async () => {
      paymentController.handleWebhook.mockImplementation((req, res) => {
        res.json({ received: true });
      });

      const response = await request(app)
        .post('/payment/stripe/webhook')
        .set('stripe-signature', 'mock_signature')
        .send({
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_abc123',
              payment_status: 'paid',
              metadata: {
                adsId: 'ads123',
                paymentId: 'payment123'
              }
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
      expect(paymentController.handleWebhook).toHaveBeenCalledTimes(1);
    });

    it('should handle checkout.session.expired event successfully', async () => {
      paymentController.handleWebhook.mockImplementation((req, res) => {
        res.json({ received: true });
      });

      const response = await request(app)
        .post('/payment/stripe/webhook')
        .set('stripe-signature', 'mock_signature')
        .send({
          type: 'checkout.session.expired',
          data: {
            object: {
              id: 'cs_test_expired',
              metadata: {
                adsId: 'ads456',
                paymentId: 'payment456'
              }
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
      expect(paymentController.handleWebhook).toHaveBeenCalledTimes(1);
    });

    it('should handle payment_intent.payment_failed event successfully', async () => {
      paymentController.handleWebhook.mockImplementation((req, res) => {
        res.json({ received: true });
      });

      const response = await request(app)
        .post('/payment/stripe/webhook')
        .set('stripe-signature', 'mock_signature')
        .send({
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_test_failed'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
      expect(paymentController.handleWebhook).toHaveBeenCalledTimes(1);
    });
  });

  describe('MoMo Webhook --- POST /payment/momo/webhook', () => {
    it('should handle successful MoMo payment webhook', async () => {
      paymentController.handleMoMoWebhook.mockImplementation((req, res) => {
        res.status(200).json({ message: 'OK' });
      });

      const response = await request(app)
        .post('/payment/momo/webhook')
        .send({
          partnerCode: 'MOMOJGOI20250919_TEST',
          orderId: 'MOMOJGOI20250919_TEST1729876543210',
          requestId: 'MOMOJGOI20250919_TEST1729876543210',
          amount: 100000,
          resultCode: 0,
          message: 'Successful',
          transId: '123456789',
          extraData: Buffer.from(JSON.stringify({
            adsId: 'ads123',
            paymentId: 'payment123'
          })).toString('base64'),
          signature: 'mock_signature'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('OK');
      expect(paymentController.handleMoMoWebhook).toHaveBeenCalledTimes(1);
    });

    it('should handle failed MoMo payment webhook', async () => {
      paymentController.handleMoMoWebhook.mockImplementation((req, res) => {
        res.status(200).json({ message: 'OK' });
      });

      const response = await request(app)
        .post('/payment/momo/webhook')
        .send({
          partnerCode: 'MOMOJGOI20250919_TEST',
          orderId: 'MOMOJGOI20250919_TEST1729876543999',
          resultCode: 1006,
          message: 'Transaction failed',
          extraData: Buffer.from(JSON.stringify({
            adsId: 'ads456',
            paymentId: 'payment456'
          })).toString('base64'),
          signature: 'mock_signature'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('OK');
      expect(paymentController.handleMoMoWebhook).toHaveBeenCalledTimes(1);
    });
  });
});