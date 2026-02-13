const express = require('express');
const router = express.Router();
const { Store } = require('../models');

// Switch store
router.post('/switch-store', (req, res) => {
  const storeId = req.body.store_id;
  if (storeId) {
    req.session.activeStoreId = parseInt(storeId);
    if (req.user.role === 'superadmin') {
      req.session.tenantStoreId = parseInt(storeId);
    }
  } else {
    delete req.session.activeStoreId;
    if (req.user.role === 'superadmin') {
      delete req.session.tenantStoreId;
    }
  }
  
  // Redirect back to where user came from
  const referer = req.headers.referer || '/dashboard';
  res.redirect(referer);
});

module.exports = router;
