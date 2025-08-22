const express = require('express');
const { signup, login } = require('../controllers/authController');

const router = express.Router();

// POST /auth/signup
router.post('/signup', signup);

// POST /auth/login
router.post('/login', login);

module.exports = router;