const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDb } = require('../config/database');
const { Owner, Store, User } = require('../models');

// SuperAdmin Dashboard
router.get('/', (req, res) => {
  const db = getDb();
  const owners = Owner.findAll({}, 'created_at DESC');
  
  // Add stats for each owner
  owners.forEach(o => {
    o.storeCount = db.prepare('SELECT COUNT(*) as c FROM stores WHERE owner_id = ?').get(o.id).c;
    o.userCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE owner_id = ?').get(o.id).c;
    o.serviceCount = db.prepare('SELECT COUNT(*) as c FROM services WHERE owner_id = ?').get(o.id).c;
    o.accessRights = Owner.getAccessRights(o.id);
    o.isExpired = o.subscription_expires_at ? new Date(o.subscription_expires_at) < new Date() : true;
  });
  
  const planConfigs = {};
  db.prepare('SELECT * FROM plan_configs').all().forEach(p => {
    planConfigs[p.plan_name] = JSON.parse(p.config_json || '{}');
  });
  
  const subConfig = db.prepare('SELECT * FROM subscription_config LIMIT 1').get() || {};
  
  const stats = {
    totalOwners: owners.length,
    activeOwners: owners.filter(o => o.status === 'active' && !o.isExpired).length,
    totalStores: db.prepare('SELECT COUNT(*) as c FROM stores').get().c,
    totalUsers: db.prepare('SELECT COUNT(*) as c FROM users WHERE role != ?').get('superadmin').c,
    totalServices: db.prepare('SELECT COUNT(*) as c FROM services').get().c,
    totalSales: db.prepare('SELECT COUNT(*) as c FROM sales').get().c
  };
  
  res.render('superadmin/index', {
    title: 'SuperAdmin Panel',
    pageTitle: 'SuperAdmin Dashboard',
    owners, planConfigs, subConfig, stats,
    layout: false
  });
});

// Create Owner/Tenant
router.post('/owner', (req, res) => {
  try {
    const db = getDb();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const owner = Owner.create({
      name: req.body.name,
      email: req.body.email.toLowerCase().trim(),
      plan: req.body.plan || 'basic',
      status: 'active',
      subscription_activated_at: new Date().toISOString(),
      subscription_expires_at: expiresAt.toISOString(),
      subscription_duration: 30
    });
    
    // Create default store
    const store = Store.create({
      owner_id: owner.id,
      name: req.body.store_name || `Toko ${req.body.name}`,
      address: req.body.address || '',
      phone: req.body.phone || ''
    });
    
    // Create owner user account
    const hashedPassword = bcrypt.hashSync(req.body.password || 'password123', 10);
    User.create({
      name: req.body.name,
      email: req.body.email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'owner',
      owner_id: owner.id,
      store_id: store.id
    });
    
    // Set default access rights
    const defaultRights = {
      menu_dashboard: true, menu_report: true, menu_service: true, menu_sales: true,
      menu_purchase: true, menu_return_sales: true, menu_return_purchase: true,
      menu_payable: true, menu_receivable: true, menu_cash: true, menu_inventory: true,
      menu_supplier: true, menu_customers: true, menu_hr: true, menu_users: true,
      menu_settings: true, menu_finance: true,
      feature_delete: true, feature_print: true, feature_share: true,
      feature_stock_add: true, feature_backup: req.body.plan === 'pro',
      feature_finance_edit: true, feature_employee_edit: true,
      feature_service_edit: true, feature_sales_edit: true,
      feature_inventory_edit: true, feature_customer_edit: true,
      feature_import_export: req.body.plan === 'pro',
      feature_multi_branch: req.body.plan === 'pro',
      feature_qc_checklist: true, feature_kelengkapan: true,
      feature_accounting: req.body.plan === 'pro'
    };
    Owner.setAccessRights(owner.id, defaultRights);
    
    req.session.flash = { success: `Tenant "${req.body.name}" berhasil dibuat` };
  } catch (error) {
    req.session.flash = { error: 'Gagal membuat tenant: ' + error.message };
  }
  res.redirect('/superadmin');
});

// Update owner access rights
router.post('/owner/:id/rights', (req, res) => {
  try {
    const rights = {};
    // All permission keys
    const allKeys = [
      'menu_dashboard', 'menu_report', 'menu_service', 'menu_sales', 'menu_purchase',
      'menu_return_sales', 'menu_return_purchase', 'menu_payable', 'menu_receivable',
      'menu_cash', 'menu_inventory', 'menu_supplier', 'menu_customers', 'menu_hr',
      'menu_users', 'menu_settings', 'menu_finance',
      'feature_delete', 'feature_print', 'feature_share', 'feature_stock_add',
      'feature_backup', 'feature_finance_edit', 'feature_employee_edit',
      'feature_service_edit', 'feature_sales_edit', 'feature_inventory_edit',
      'feature_customer_edit', 'feature_import_export', 'feature_multi_branch',
      'feature_qc_checklist', 'feature_kelengkapan', 'feature_accounting'
    ];
    
    allKeys.forEach(key => {
      rights[key] = req.body[key] === 'on' || req.body[key] === '1' || req.body[key] === 'true';
    });
    
    Owner.setAccessRights(req.params.id, rights);
    req.session.flash = { success: 'Hak akses berhasil diperbarui' };
  } catch (error) {
    req.session.flash = { error: 'Gagal memperbarui hak akses' };
  }
  res.redirect('/superadmin');
});

// Extend subscription
router.post('/owner/:id/extend', (req, res) => {
  try {
    const owner = Owner.findById(req.params.id);
    const duration = parseInt(req.body.duration) || 30;
    const currentExpiry = owner.subscription_expires_at ? new Date(owner.subscription_expires_at) : new Date();
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    baseDate.setDate(baseDate.getDate() + duration);
    
    Owner.update(req.params.id, {
      subscription_expires_at: baseDate.toISOString(),
      subscription_duration: duration,
      status: 'active',
      updated_at: new Date().toISOString()
    });
    
    if (!owner.subscription_activated_at) {
      Owner.update(req.params.id, { subscription_activated_at: new Date().toISOString() });
    }
    
    // Record payment
    Owner.addPayment(req.params.id, {
      amount: parseFloat(req.body.amount) || 0,
      duration,
      method: req.body.method || '',
      notes: req.body.notes || ''
    });
    
    req.session.flash = { success: `Langganan diperpanjang ${duration} hari` };
  } catch (error) {
    req.session.flash = { error: 'Gagal memperpanjang langganan' };
  }
  res.redirect('/superadmin');
});

// Update owner plan
router.post('/owner/:id/plan', (req, res) => {
  try {
    Owner.update(req.params.id, { plan: req.body.plan, updated_at: new Date().toISOString() });
    req.session.flash = { success: 'Plan berhasil diubah' };
  } catch (e) {
    req.session.flash = { error: 'Gagal mengubah plan' };
  }
  res.redirect('/superadmin');
});

// Send admin message
router.post('/owner/:id/message', (req, res) => {
  try {
    Owner.update(req.params.id, {
      admin_message: req.body.message,
      admin_message_at: new Date().toISOString()
    });
    req.session.flash = { success: 'Pesan berhasil dikirim' };
  } catch (e) {
    req.session.flash = { error: 'Gagal mengirim pesan' };
  }
  res.redirect('/superadmin');
});

// Spy mode - enter tenant context
router.post('/spy/:ownerId', (req, res) => {
  const owner = Owner.findById(req.params.ownerId);
  if (!owner) {
    req.session.flash = { error: 'Owner tidak ditemukan' };
    return res.redirect('/superadmin');
  }
  
  const stores = Store.findByOwner(owner.id);
  req.session.tenantOwnerId = owner.id;
  req.session.tenantStoreId = stores.length > 0 ? stores[0].id : null;
  
  req.session.flash = { info: `Spy Mode aktif - Melihat sebagai "${owner.name}"` };
  res.redirect('/dashboard');
});

// Exit spy mode
router.get('/exit-spy', (req, res) => {
  delete req.session.tenantOwnerId;
  delete req.session.tenantStoreId;
  res.redirect('/superadmin');
});

// Delete owner
router.post('/owner/:id/delete', (req, res) => {
  try {
    const db = getDb();
    db.transaction(() => {
      // Delete all related data
      const ownerId = req.params.id;
      db.prepare('DELETE FROM users WHERE owner_id = ?').run(ownerId);
      db.prepare('DELETE FROM stores WHERE owner_id = ?').run(ownerId);
      db.prepare('DELETE FROM services WHERE owner_id = ?').run(ownerId);
      db.prepare('DELETE FROM sales WHERE owner_id = ?').run(ownerId);
      db.prepare('DELETE FROM inventory WHERE owner_id = ?').run(ownerId);
      db.prepare('DELETE FROM transactions WHERE owner_id = ?').run(ownerId);
      db.prepare('DELETE FROM customers WHERE owner_id = ?').run(ownerId);
      db.prepare('DELETE FROM suppliers WHERE owner_id = ?').run(ownerId);
      db.prepare('DELETE FROM purchases WHERE owner_id = ?').run(ownerId);
      db.prepare('DELETE FROM debts WHERE owner_id = ?').run(ownerId);
      db.prepare('DELETE FROM cash_accounts WHERE owner_id = ?').run(ownerId);
      db.prepare('DELETE FROM cash_flow WHERE owner_id = ?').run(ownerId);
      db.prepare('DELETE FROM owner_access_rights WHERE owner_id = ?').run(ownerId);
      Owner.delete(ownerId);
    })();
    req.session.flash = { success: 'Tenant berhasil dihapus' };
  } catch (error) {
    req.session.flash = { error: 'Gagal menghapus tenant' };
  }
  res.redirect('/superadmin');
});

module.exports = router;
