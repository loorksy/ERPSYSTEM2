(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function showToast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
    else alert(msg);
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  async function loadCycles() {
    var body = $('pnListBody');
    try {
      var res = await fetch('/api/payroll-native/cycles');
      var data = await res.json();
      if (!data.success) {
        body.innerHTML = '<p class="text-red-600">' + escapeHtml(data.message || 'فشل التحميل') + '</p>';
        return;
      }
      if (!data.cycles || !data.cycles.length) {
        body.innerHTML = '<p class="text-slate-500">لا توجد دورات بعد. أنشئ دورة وارفع الملفات.</p>';
        return;
      }
      var html = '<div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="text-right border-b border-slate-200">';
      html += '<th class="py-2 px-3">الاسم</th><th class="py-2 px-3">آخر تحديث</th><th class="py-2 px-3"></th></tr></thead><tbody>';
      data.cycles.forEach(function (c) {
        var d = c.updated_at ? new Date(c.updated_at).toLocaleString('ar') : '—';
        html +=
          '<tr class="border-b border-slate-100 hover:bg-slate-50">' +
          '<td class="py-2 px-3 font-medium text-slate-800">' +
          escapeHtml(c.name) +
          '</td>' +
          '<td class="py-2 px-3 text-slate-500">' +
          d +
          '</td>' +
          '<td class="py-2 px-3 whitespace-nowrap">' +
          '<a href="/payroll/cycle/' +
          c.id +
          '" class="inline-flex items-center gap-1 text-indigo-600 font-medium pn-open">فتح المحرّر</a> ' +
          '<button type="button" class="text-red-600 mr-2 pn-del" data-id="' +
          c.id +
          '">حذف</button>' +
          '</td></tr>';
      });
      html += '</tbody></table></div>';
      body.innerHTML = html;
      body.querySelectorAll('.pn-del').forEach(function (btn) {
        btn.addEventListener('click', function () {
          deleteCycle(parseInt(btn.getAttribute('data-id'), 10));
        });
      });
    } catch (e) {
      body.innerHTML = '<p class="text-red-600">' + escapeHtml(e.message) + '</p>';
    }
  }

  async function deleteCycle(id) {
    if (!confirm('حذف هذه الدورة نهائياً؟')) return;
    try {
      var res = await fetch('/api/payroll-native/cycles/' + id, { method: 'DELETE' });
      var data = await res.json();
      if (data.success) {
        showToast(data.message || 'تم الحذف', 'success');
        loadCycles();
      } else showToast(data.message || 'فشل', 'error');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadCycles();

    $('pnCreateForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('pnCreateBtn');
      var fd = new FormData();
      fd.append('name', ($('pnNewName').value || '').trim());
      var f1 = $('pnFileMgmt').files[0];
      var f2 = $('pnFileAgent').files[0];
      var f3 = $('pnFileUser').files[0];
      if (f1) fd.append('management', f1);
      if (f2) fd.append('agent', f2);
      if (f3) fd.append('userInfo', f3);
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      }
      try {
        var res = await fetch('/api/payroll-native/cycles', { method: 'POST', body: fd });
        var data = await res.json();
        if (data.success) {
          showToast(data.message || 'تم', 'success');
          $('pnCreateForm').reset();
          $('pnNewName').value = '';
          if (data.cycleId) {
            window.location.href = '/payroll/cycle/' + data.cycleId;
            return;
          }
          loadCycles();
        } else showToast(data.message || 'فشل', 'error');
      } catch (err) {
        showToast(err.message, 'error');
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus"></i> إنشاء الدورة';
      }
    });
  });
})();
