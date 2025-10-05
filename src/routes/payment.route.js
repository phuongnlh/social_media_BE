const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const { isLogin } = require("../middlewares/auth");

router.post('/checkout', isLogin, paymentController.createCheckoutSession);
// Webhook endpoints
router.post("/stripe/webhook", express.raw({ type: 'application/json' }), paymentController.handleWebhook);
router.post("/momo/webhook", paymentController.handleMoMoWebhook);
router.post("/momo/query/:orderId", isLogin, paymentController.queryMoMoPaymentStatus);
router.post("/momo/cancel/:orderId", isLogin, paymentController.cancelMoMoPayment);

router.get("/verify-success", isLogin, paymentController.verifyPaymentSuccess);
router.post("/cancel", isLogin, paymentController.handlePaymentCancel);
router.get("/history", isLogin, paymentController.getPaymentHistory);
module.exports = router;