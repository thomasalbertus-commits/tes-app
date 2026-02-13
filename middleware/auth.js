const { User, Owner, Store } = require('../models');

// Check if user is logged in
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }

  // Load user data into request
  const user = User.findById(req.session.userId);
  if (!user) {
    req.session.destroy();
    return res.redirect('/login');
  }

  req.user = user;
  delete req.user.password; // Never expose password

  // Load owner data if available
  if (user.owner_id) {
    req.owner = Owner.findById(user.owner_id);
    req.ownerAccessRights = Owner.getAccessRights(user.owner_id);
  }

  // Load store data if available
  if (user.store_id) {
    req.store = Store.findById(user.store_id);
  }

  // Load available stores
  if (user.owner_id) {
    req.availableStores = Store.findByOwner(user.owner_id);
  }

  // Make user data available in all templates
  res.locals.currentUser = req.user;
  res.locals.currentOwner = req.owner;
  res.locals.currentStore = req.store;
  res.locals.availableStores = req.availableStores || [];
  res.locals.accessRights = req.ownerAccessRights || {};

  next();
}

// Check if user is superadmin
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).render('errors/403', { message: 'Akses Ditolak - Hanya SuperAdmin' });
  }
  next();
}

// Check if user is owner or superadmin
function requireOwner(req, res, next) {
  if (!req.user || !['owner', 'superadmin'].includes(req.user.role)) {
    return res.status(403).render('errors/403', { message: 'Akses Ditolak - Hanya Owner' });
  }
  next();
}

// Check if tenant context is set (owner_id exists)
function requireTenant(req, res, next) {
  if (!req.user.owner_id && req.user.role !== 'superadmin') {
    return res.redirect('/login');
  }

  // For superadmin, must have entered tenant context
  if (req.user.role === 'superadmin' && !req.session.tenantOwnerId) {
    return res.redirect('/superadmin');
  }

  // Set effective owner_id and store_id
  if (req.user.role === 'superadmin') {
    req.effectiveOwnerId = req.session.tenantOwnerId;
    req.effectiveStoreId = req.session.tenantStoreId;
    const owner = Owner.findById(req.effectiveOwnerId);
    if (owner) {
      req.owner = owner;
      req.ownerAccessRights = Owner.getAccessRights(owner.id);
      res.locals.currentOwner = owner;
      res.locals.accessRights = req.ownerAccessRights;
    }
    req.availableStores = Store.findByOwner(req.effectiveOwnerId);
    res.locals.availableStores = req.availableStores;
    if (req.effectiveStoreId) {
      req.store = Store.findById(req.effectiveStoreId);
      res.locals.currentStore = req.store;
    }
  } else {
    req.effectiveOwnerId = req.user.owner_id;
    req.effectiveStoreId = req.user.store_id || req.session.activeStoreId;
  }

  next();
}

// Check subscription status
function checkSubscription(req, res, next) {
  if (req.user.role === 'superadmin') return next();

  if (req.owner && req.owner.subscription_expires_at) {
    const expiresAt = new Date(req.owner.subscription_expires_at);
    if (expiresAt < new Date()) {
      return res.render('subscription-expired', {
        owner: req.owner,
        title: 'Langganan Kedaluwarsa',
        layout: false
      });
    }
  }
  next();
}

// Check menu permission
function checkMenuPermission(menuKey) {
  return (req, res, next) => {
    if (req.user.role === 'superadmin' || req.user.role === 'owner') return next();

    const rights = req.ownerAccessRights || {};
    if (rights[menuKey] === false) {
      return res.status(403).render('errors/403', { message: `Anda tidak memiliki akses ke menu ini` });
    }
    next();
  };
}

// Check feature permission
function checkFeaturePermission(featureKey) {
  return (req, res, next) => {
    if (req.user.role === 'superadmin' || req.user.role === 'owner') return next();

    const rights = req.ownerAccessRights || {};
    // Essential features default to enabled
    const essentialFeatures = ['feature_delete', 'feature_print', 'feature_share'];
    if (essentialFeatures.includes(featureKey)) {
      if (rights[featureKey] === false) {
        return res.status(403).json({ error: 'Akses fitur tidak tersedia' });
      }
      return next();
    }

    if (rights[featureKey] === false) {
      return res.status(403).json({ error: 'Akses fitur tidak tersedia' });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireSuperAdmin,
  requireOwner,
  requireTenant,
  checkSubscription,
  checkMenuPermission,
  checkFeaturePermission
};
