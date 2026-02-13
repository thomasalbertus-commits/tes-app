const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { User, Owner, Store } = require('../models');

// GET /login
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('auth/login', { title: 'Login', error: null, email: '', layout: false });
});

// POST /login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render('auth/login', { title: 'Login', error: 'Email dan password harus diisi', email, layout: false });
  }

  const user = User.findByEmail(email.toLowerCase().trim());
  if (!user) {
    return res.render('auth/login', { title: 'Login', error: 'Email atau password salah', email, layout: false });
  }

  if (!user.is_active) {
    return res.render('auth/login', { title: 'Login', error: 'Akun Anda telah dinonaktifkan', email, layout: false });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.render('auth/login', { title: 'Login', error: 'Email atau password salah', email, layout: false });
  }

  // Set session
  req.session.userId = user.id;
  req.session.userRole = user.role;

  // Redirect based on role
  if (user.role === 'superadmin') {
    return res.redirect('/superadmin');
  }

  return res.redirect('/dashboard');
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
