const request = require('supertest');
const express = require('express');
const router = require('../routes/users');
const UserController = require('../controllers/user.controller');
const { isLogin } = require('../middlewares/auth');

const app = express();
app.use(express.json());
app.use('/users', router);

// Mock the controller
jest.mock('../controllers/user.controller');

// Mock the auth middleware
jest.mock('../middlewares/auth', () => ({
  isLogin: jest.fn((req, res, next) => {
    req.user = { _id: 'mockUserId123' };
    next();
  })
}));

describe('User Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Register', () => {
    it('should register a new user successfully', async () => {
      UserController.registerUser.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Registration successful! Please check your email to verify your account.'
        });
      });

      const response = await request(app)
        .post('/users/register')
        .send({
          fullName: 'John Doe',
          email: 'john@example.com',
          password: 'Password123!',
          gender: 'male',
          dateOfBirth: '1990-01-01'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('Registration successful');
      expect(UserController.registerUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('Login', () => {
    it('should login successfully with valid credentials', async () => {
      UserController.loginUser.mockImplementation((req, res) => {
        res.status(200).json({ accessToken: 'mockAccessToken123' });
      });

      const response = await request(app)
        .post('/users/login')
        .send({
          email: 'john@example.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(UserController.loginUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('Verify Email', () => {
    it('should verify email successfully with valid token', async () => {
      UserController.verifyEmail.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Email verified successfully!' });
      });

      const response = await request(app)
        .get('/users/verify-email')
        .query({ token: 'validToken123' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Email verified successfully!');
      expect(UserController.verifyEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Change Password', () => {
    it('should change password successfully', async () => {
      UserController.changePassword.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Password changed successfully. Please log in again.'
        });
      });

      const response = await request(app)
        .post('/users/change-password')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          oldPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password changed successfully');
      expect(isLogin).toHaveBeenCalled();
    });
  });

  describe('Forgot Password', () => {
    it('should send reset password email successfully', async () => {
      UserController.forgotPassword.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Liên kết đặt lại mật khẩu đã được gửi đến email'
        });
      });

      const response = await request(app)
        .post('/users/forgot-password')
        .send({
          email: 'john@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('đặt lại mật khẩu');
      expect(UserController.forgotPassword).toHaveBeenCalledTimes(1);
    });
  });
});