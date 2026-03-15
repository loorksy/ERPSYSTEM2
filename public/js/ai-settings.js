async function saveAIKey(provider) {
  var inputId = provider === 'openai' ? 'openaiKey' : 'geminiKey';
  var inputEl = document.getElementById(inputId);
  var apiKey = (inputEl && inputEl.value) ? inputEl.value.trim() : '';
  if (!apiKey) {
    showToast('الرجاء إدخال مفتاح API', 'error');
    return;
  }

  var btnId = provider === 'openai' ? 'openaiSaveBtn' : 'geminiSaveBtn';
  var btn = document.getElementById(btnId);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الاتصال...';
  }

  var res = await apiCall('/ai/save-key', { method: 'POST', body: JSON.stringify({ provider: provider, apiKey: apiKey }) });

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> حفظ';
  }

  var msg = (res && res.message) ? res.message : (res && res.success ? 'تم الحفظ' : 'حدث خطأ');
  showToast(msg, (res && res.success) ? 'success' : 'error');

  if (res && res.success && res.models && res.models.length) {
    populateModels(provider, res.models);
    if (inputEl) inputEl.value = '';
    var select = document.getElementById(provider === 'openai' ? 'openaiModelSelect' : 'geminiModelSelect');
    if (select && res.selectedModel) select.value = res.selectedModel;
  }
  loadAIStatus();
}

async function selectModel(provider, model) {
  if (!model) return;
  const res = await apiCall('/ai/select-model', { method: 'POST', body: JSON.stringify({ provider, model }) });
  showToast(res.message, res.success ? 'success' : 'error');
  loadAIStatus();
}

async function refreshModels(provider) {
  const res = await apiCall('/ai/refresh-models', { method: 'POST', body: JSON.stringify({ provider }) });
  if (res.success && res.models) {
    populateModels(provider, res.models);
    showToast('تم تحديث الموديلات', 'success');
  } else {
    showToast(res.message || 'فشل التحديث', 'error');
  }
}

function populateModels(provider, models) {
  if (!models || !models.length) return;
  var selectId = provider === 'openai' ? 'openaiModelSelect' : 'geminiModelSelect';
  var sectionId = provider === 'openai' ? 'openaiModelsSection' : 'geminiModelsSection';
  var select = document.getElementById(selectId);
  var section = document.getElementById(sectionId);
  if (!select || !section) return;

  select.innerHTML = '<option value="">اختر موديل...</option>';
  models.forEach(function(m) {
    select.innerHTML += '<option value="' + (m || '').replace(/"/g, '&quot;') + '">' + (m || '') + '</option>';
  });
  section.classList.remove('hidden');
}

async function loadAIStatus() {
  try {
    const data = await apiCall('/ai/status');

    ['openai', 'gemini'].forEach(p => {
      const badge = document.getElementById(p + 'StatusBadge');
      const section = document.getElementById(p + 'ModelsSection');
      const select = document.getElementById(p + 'ModelSelect');

      if (data[p]?.configured) {
        badge.textContent = data[p].selectedModel ? '✓ ' + data[p].selectedModel : '✓ مُعدّ';
        badge.className = 'mr-auto text-xs font-medium py-1 px-3 rounded-full ' +
          (data[p].selectedModel ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600');

        if (data[p].models?.length) {
          populateModels(p, data[p].models);
          if (data[p].selectedModel) select.value = data[p].selectedModel;
        }
      } else {
        badge.textContent = 'غير مُعدّ';
        badge.className = 'mr-auto text-xs font-medium py-1 px-3 rounded-full bg-slate-100 text-slate-500';
        if (section) section.classList.add('hidden');
      }
    });
  } catch {}
}

document.addEventListener('DOMContentLoaded', loadAIStatus);
