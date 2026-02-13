const express = require('express');
const router = express.Router();
const { Service, Store } = require('../models');
const { getDb } = require('../config/database');

// Public tracking page
router.get('/', (req, res) => {
  const token = req.query.token || '';
  
  if (!token) {
    return res.render('tracking/index', { title: 'Tracking Servis', service: null, store: null, token: '', layout: false });
  }
  
  const service = Service.findWithParts(null); // we need to search by token
  const db = getDb();
  const found = db.prepare('SELECT * FROM services WHERE token = ?').get(token.toUpperCase().trim());
  
  if (!found) {
    return res.render('tracking/index', { title: 'Tracking Servis', service: null, store: null, token, error: 'Token tidak ditemukan', layout: false });
  }
  
  // Get parts
  found.parts = db.prepare('SELECT * FROM service_parts WHERE service_id = ?').all(found.id);
  found.qc = db.prepare('SELECT * FROM service_qc WHERE service_id = ?').all(found.id);
  found.kelengkapan = db.prepare('SELECT * FROM service_kelengkapan WHERE service_id = ?').all(found.id);
  
  const store = found.store_id ? Store.findById(found.store_id) : null;
  
  res.render('tracking/index', { title: `Tracking #${token}`, service: found, store, token, layout: false });
});

module.exports = router;
