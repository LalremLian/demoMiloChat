const express = require('express');
const router = express.Router();

const {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  verifyEmail,
} = require('../controllers/authController');

const {
  registerValidator,
  loginValidator,
  refreshTokenValidator,
  logoutValidator,
  forgotPasswordValidator,
  verifyEmailValidator,
} = require('../validators/authValidators');

// POST /api/auth/register
router.post('/register', registerValidator, register);

// POST /api/auth/login
router.post('/login', loginValidator, login);

// POST /api/auth/refresh
router.post('/refresh', refreshTokenValidator, refreshToken);

// POST /api/auth/logout
router.post('/logout', logoutValidator, logout);

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPasswordValidator, forgotPassword);

// POST /api/auth/verify
router.post('/verify', verifyEmailValidator, verifyEmail);

module.exports = router;
