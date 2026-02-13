// Helpers available in all EJS templates
module.exports = function(req, res, next) {
  // Format currency IDR
  res.locals.formatCurrency = (n) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(n || 0);
  };

  // Format date
  res.locals.formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format date only (no time)
  res.locals.formatDateOnly = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Status badge color
  res.locals.statusColor = (status) => {
    const colors = {
      'Diterima': 'bg-blue-100 text-blue-800',
      'Diagnosa': 'bg-yellow-100 text-yellow-800',
      'Menunggu Sparepart': 'bg-orange-100 text-orange-800',
      'Selesai': 'bg-green-100 text-green-800',
      'Dibatalkan': 'bg-red-100 text-red-800',
      'Lunas': 'bg-green-100 text-green-800',
      'DP': 'bg-yellow-100 text-yellow-800',
      'Belum Bayar': 'bg-red-100 text-red-800',
      'Belum Lunas': 'bg-red-100 text-red-800',
      'active': 'bg-green-100 text-green-800',
      'inactive': 'bg-red-100 text-red-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'draft': 'bg-gray-100 text-gray-800',
      'paid': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Flash messages
  res.locals.flash = {
    success: req.session?.flash?.success,
    error: req.session?.flash?.error,
    info: req.session?.flash?.info
  };
  if (req.session?.flash) {
    delete req.session.flash;
  }

  // Active menu helper
  res.locals.isActive = (path) => {
    return req.path.startsWith(path) ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white';
  };

  // Current path
  res.locals.currentPath = req.path;

  next();
};
