/**
 * توافق: يحمّل وحدات الاعتمادات بالترتيب (utils → bulk → page).
 * يُفضّل في dashboard.ejs استخدام الوسوم الثلاثة مباشرة.
 */
(function() {
  var base = '/js/approvals/';
  var scripts = ['utils.js', 'bulk.js', 'page.js'];
  var i = 0;
  function next() {
    if (i >= scripts.length) return;
    var s = document.createElement('script');
    s.src = base + scripts[i++];
    s.onload = next;
    s.onerror = function() {
      console.error('[approvals] فشل التحميل:', s.src);
    };
    (document.head || document.documentElement).appendChild(s);
  }
  next();
})();
