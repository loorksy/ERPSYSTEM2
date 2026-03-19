window.currencySymbol = '$';
window.formatMoney = function(num) {
  var n = typeof num === 'number' ? num : parseFloat(num) || 0;
  var s = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var sym = window.currencySymbol;
  return (sym && sym !== '') ? s + ' ' + sym : s;
};

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initDate();
  initHomeSheetsStatus();
  initHomeStats();
  fetch('/settings/currency', { credentials: 'same-origin' })
    .then(r => r.json())
    .then(d => { if (d.success && d.symbol) window.currencySymbol = d.symbol; })
    .catch(() => {});
});

function initHomeStats() {
  var cycleSel = document.getElementById('homeCycleSelect');
  if (!cycleSel) return;
  window.homeLoadStats = function() {
    var cycleId = cycleSel ? cycleSel.value : '';
    fetch('/dashboard/stats' + (cycleId ? '?cycleId=' + cycleId : ''), { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.success) return;
        var cycles = data.cycles || [];
        if (cycleSel && cycles.length && !cycleSel.dataset.filled) {
          cycleSel.innerHTML = '<option value="">-- اختر الدورة --</option>' + cycles.map(function(c) {
            return '<option value="' + c.id + '"' + (c.id === data.cycleId ? ' selected' : '') + '>' + (c.name || '') + '</option>';
          }).join('');
          cycleSel.dataset.filled = '1';
        }
        var cash = document.getElementById('cashBalance');
        var deferred = document.getElementById('deferredBalance');
        var shipping = document.getElementById('shippingBalance');
        if (cash) cash.textContent = formatMoney(data.cashBalance || 0);
        if (deferred) deferred.textContent = formatMoney(data.deferredBalance || 0);
        if (shipping) shipping.textContent = formatMoney(data.shippingBalance || 0);
        var link = document.getElementById('deferredBalanceLink');
        if (link && data.cycleId) link.href = '/deferred-balance?cycleId=' + data.cycleId;
      })
      .catch(function() {});
  };
  homeLoadStats();
}

function initHomeSheetsStatus() {
  var el = document.getElementById('homeSheetsStatus');
  if (!el) return;
  fetch('/sheets/status', { credentials: 'same-origin' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success && data.connected) {
        el.textContent = 'مفعل';
        el.className = 'text-xs font-medium py-0.5 px-2.5 rounded-full bg-emerald-50 text-emerald-600';
      } else {
        el.textContent = 'غير مفعل';
        el.className = 'text-xs font-medium py-0.5 px-2.5 rounded-full bg-red-50 text-red-500';
      }
    })
    .catch(function() {
      el.textContent = 'غير مفعل';
      el.className = 'text-xs font-medium py-0.5 px-2.5 rounded-full bg-red-50 text-red-500';
    });
}


function initSidebar() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const sidebarClose = document.getElementById('sidebarClose');

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.remove('max-lg:translate-x-full');
      sidebar.classList.add('translate-x-0', 'shadow-[-4px_0_24px_rgba(0,0,0,0.2)]');
      sidebarOverlay.classList.remove('hidden');
      sidebarOverlay.classList.add('block');
      document.body.style.overflow = 'hidden';
    });
  }

  function closeSidebar() {
    sidebar.classList.add('max-lg:translate-x-full');
    sidebar.classList.remove('translate-x-0', 'shadow-[-4px_0_24px_rgba(0,0,0,0.2)]');
    sidebarOverlay.classList.add('hidden');
    sidebarOverlay.classList.remove('block');
    document.body.style.overflow = '';
  }

  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);

  let startX = 0, currentX = 0, isDragging = false;
  sidebar?.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; isDragging = true; });
  sidebar?.addEventListener('touchmove', (e) => { if (!isDragging) return; currentX = e.touches[0].clientX; const d = currentX - startX; if (d > 0) sidebar.style.transform = `translateX(${d}px)`; });
  sidebar?.addEventListener('touchend', () => { isDragging = false; if (currentX - startX > 80) closeSidebar(); sidebar.style.transform = ''; currentX = 0; startX = 0; });
}

function initDate() {
  const el = document.getElementById('currentDate');
  if (el) el.textContent = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function switchTab(btn, tabId) {
  var card = btn.closest('[data-tabs-container="settings"]') || document.getElementById('settingsCard') || btn.closest('.bg-white');
  if (!card) return;
  var tabs = card.querySelectorAll('.tab-content');
  var targetTab = document.getElementById(tabId);
  tabs.forEach(function(t) {
    t.classList.add('hidden');
    t.style.display = 'none';
  });
  if (targetTab) {
    targetTab.classList.remove('hidden');
    targetTab.style.display = '';
    targetTab.setAttribute('aria-hidden', 'false');
  }
  tabs.forEach(function(t) {
    if (t !== targetTab) t.setAttribute('aria-hidden', 'true');
  });
  card.querySelectorAll('.tab-btn').forEach(function(b) {
    b.className = 'tab-btn px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 bg-slate-100 text-slate-600 hover:bg-slate-200';
  });
  btn.className = 'tab-btn px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 bg-indigo-600 text-white shadow-md';
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const isSuccess = type === 'success';
  const toast = document.createElement('div');
  toast.className = `flex items-center gap-2.5 py-3.5 px-5 bg-white rounded-xl shadow-lg min-w-[280px] max-w-[400px] text-[0.9rem] animate-[toastIn_0.3s_ease] border-r-4 ${isSuccess ? 'border-r-emerald-500' : 'border-r-red-500'}`;
  toast.innerHTML = `
    <i class="fas fa-${isSuccess ? 'check-circle text-emerald-500' : 'exclamation-circle text-red-500'}"></i>
    <span>${message}</span>
    <button class="mr-auto text-slate-400 p-1 cursor-pointer hover:text-slate-600" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'toastOut 0.3s ease'; setTimeout(() => toast.remove(), 300); }, 4000);
}

async function apiCall(url, options = {}) {
  var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (options.headers) {
    headers = Object.assign({}, headers, options.headers);
    delete options.headers;
  }
  try {
    var res = await fetch(url, { credentials: 'same-origin', headers: headers, ...options });
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok) {
      return { success: false, message: data.message || data.error || ('خطأ من الخادم: ' + res.status) };
    }
    return data;
  } catch (err) {
    return { success: false, message: 'خطأ في الاتصال بالخادم. تحقق من تشغيل السيرفر والشبكة.' };
  }
}

async function updateProfile(e) {
  e.preventDefault();
  const result = await apiCall('/settings/update-profile', { method: 'POST', body: JSON.stringify({ displayName: document.getElementById('displayName').value }) });
  showToast(result.message, result.success ? 'success' : 'error');
  if (result.success) setTimeout(() => location.reload(), 1000);
}

async function changePassword(e) {
  e.preventDefault();
  const result = await apiCall('/settings/change-password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: document.getElementById('currentPassword').value,
      newPassword: document.getElementById('newPassword').value,
      confirmPassword: document.getElementById('confirmPassword').value
    })
  });
  showToast(result.message, result.success ? 'success' : 'error');
  if (result.success) document.getElementById('passwordForm').reset();
}
