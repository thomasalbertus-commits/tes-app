// iFix Pro Enterprise - Frontend JavaScript

document.addEventListener('DOMContentLoaded', function () {
  // ─── Initialize Lucide Icons ───────────────────────────────
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // ─── Sidebar Toggle (Mobile) ──────────────────────────────
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
      if (sidebarOverlay) {
        sidebarOverlay.classList.toggle('hidden');
      }
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full');
      sidebarOverlay.classList.add('hidden');
    });
  }

  // ─── Auto-dismiss Flash Messages ──────────────────────────
  const flashMessages = document.querySelectorAll('.flash-message');
  flashMessages.forEach(msg => {
    setTimeout(() => {
      msg.style.transition = 'opacity 0.5s, transform 0.5s';
      msg.style.opacity = '0';
      msg.style.transform = 'translateY(-10px)';
      setTimeout(() => msg.remove(), 500);
    }, 5000);
  });

  // ─── Store Switcher ───────────────────────────────────────
  const storeSwitcher = document.getElementById('storeSwitcher');
  if (storeSwitcher) {
    storeSwitcher.addEventListener('change', function () {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/switch-store';

      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'store_id';
      input.value = this.value;
      form.appendChild(input);

      document.body.appendChild(form);
      form.submit();
    });
  }

  // ─── Confirm Delete ───────────────────────────────────────
  document.querySelectorAll('[data-confirm]').forEach(el => {
    el.addEventListener('click', function (e) {
      if (!confirm(this.dataset.confirm || 'Yakin ingin menghapus?')) {
        e.preventDefault();
      }
    });
  });

  // ─── Toast Notifications ──────────────────────────────────
  window.showToast = function (message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      info: 'bg-blue-500',
      warning: 'bg-yellow-500'
    };
    toast.className = `fixed top-4 right-4 z-[9999] px-6 py-3 rounded-xl text-white font-semibold text-sm shadow-lg ${colors[type] || colors.info}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.5s';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  };

  // ─── Print Helper ─────────────────────────────────────────
  window.printPage = function () {
    window.print();
  };

  // ─── Number Formatting ────────────────────────────────────
  window.formatRupiah = function (num) {
    return new Intl.NumberFormat('id-ID').format(num || 0);
  };

  // ─── Auto-format Currency Inputs ──────────────────────────
  document.querySelectorAll('input[data-currency]').forEach(input => {
    input.addEventListener('input', function () {
      let val = this.value.replace(/[^\d]/g, '');
      this.value = val ? parseInt(val).toLocaleString('id-ID') : '';
      // Store raw value in hidden field if exists
      const hidden = document.getElementById(this.dataset.currency);
      if (hidden) hidden.value = val;
    });
  });
});

// ─── Global Functions ──────────────────────────────────────
// Store switcher function (called from sidebar select)
window.switchStore = function(storeId) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/api/switch-store';
  
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'store_id';
  input.value = storeId;
  form.appendChild(input);
  
  document.body.appendChild(form);
  form.submit();
};
