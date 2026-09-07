/**
 * Klooker team gate — password shared for source download + Image Finder.
 * Not bank-grade; stops casual public access.
 */
(function (global) {
  var SALT = 'klooker-media-vn-2026';
  var HASH = '233b47256d41d9a8006dd9288992531c20d5ab98fafbf5af7460ebaeea942fac';
  var KEY = 'klooker_team_ok_v1';

  function sha256Hex(str) {
    if (global.crypto && crypto.subtle) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
        return Array.from(new Uint8Array(buf)).map(function (b) {
          return b.toString(16).padStart(2, '0');
        }).join('');
      });
    }
    return Promise.reject(new Error('Crypto unavailable'));
  }

  function isAuthed() {
    try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }

  function setAuthed() {
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
  }

  function clearAuthed() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }

  function checkPassword(pw) {
    return sha256Hex(SALT + String(pw || '')).then(function (h) {
      return h === HASH;
    });
  }

  function injectStyles() {
    if (document.getElementById('klooker-gate-css')) return;
    var css = document.createElement('style');
    css.id = 'klooker-gate-css';
    css.textContent = [
      '#klooker-gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;',
      'background:rgba(8,12,24,.72);backdrop-filter:blur(10px);font-family:Manrope,Inter,system-ui,sans-serif}',
      '#klooker-gate .box{width:min(420px,92vw);background:#fff;border-radius:20px;padding:28px 24px;',
      'box-shadow:0 24px 60px rgba(0,0,0,.28);color:#0f172a}',
      '#klooker-gate h1{margin:0 0 6px;font-size:1.35rem;font-weight:800}',
      '#klooker-gate p{margin:0 0 16px;color:#64748b;font-size:.92rem;line-height:1.5}',
      '#klooker-gate label{display:block;font-size:.8rem;font-weight:700;margin-bottom:6px}',
      '#klooker-gate input{width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid #e2e8f0;',
      'border-radius:12px;font:inherit;margin-bottom:12px}',
      '#klooker-gate button{width:100%;padding:12px 14px;border:0;border-radius:999px;background:#2563eb;',
      'color:#fff;font-weight:800;cursor:pointer;font:inherit}',
      '#klooker-gate .err{color:#b91c1c;font-size:.85rem;min-height:1.2em;margin:0 0 8px}',
      '#klooker-gate .hint{font-size:.78rem;color:#94a3b8;margin-top:12px;text-align:center}'
    ].join('');
    document.head.appendChild(css);
  }

  function showGate(opts) {
    opts = opts || {};
    if (isAuthed()) {
      if (typeof opts.onOk === 'function') opts.onOk();
      return Promise.resolve(true);
    }
    injectStyles();
    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.id = 'klooker-gate';
      wrap.innerHTML = [
        '<div class="box" role="dialog" aria-modal="true" aria-labelledby="klooker-gate-title">',
        '<h1 id="klooker-gate-title">Klooker Media — Team</h1>',
        '<p>' + (opts.message || 'Nhập mật khẩu team để dùng Image Finder / tải source.') + '</p>',
        '<label for="klooker-gate-pw">Mật khẩu</label>',
        '<input id="klooker-gate-pw" type="password" autocomplete="current-password" placeholder="••••••••"/>',
        '<p class="err" id="klooker-gate-err"></p>',
        '<button type="button" id="klooker-gate-btn">Vào</button>',
        '<p class="hint">Phiên đăng nhập giữ đến khi đóng tab trình duyệt.</p>',
        '</div>'
      ].join('');
      document.body.appendChild(wrap);
      var input = document.getElementById('klooker-gate-pw');
      var err = document.getElementById('klooker-gate-err');
      var btn = document.getElementById('klooker-gate-btn');
      function fail(msg) { err.textContent = msg || 'Sai mật khẩu.'; }
      function tryLogin() {
        btn.disabled = true;
        checkPassword(input.value).then(function (ok) {
          if (!ok) {
            btn.disabled = false;
            fail('Sai mật khẩu.');
            input.focus();
            input.select();
            return;
          }
          setAuthed();
          wrap.remove();
          if (typeof opts.onOk === 'function') opts.onOk();
          resolve(true);
        }).catch(function () {
          btn.disabled = false;
          fail('Trình duyệt không hỗ trợ mã hóa. Thử Chrome/Safari mới.');
        });
      }
      btn.addEventListener('click', tryLogin);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') tryLogin();
      });
      setTimeout(function () { input.focus(); }, 50);
    });
  }

  global.KlookerGate = {
    isAuthed: isAuthed,
    setAuthed: setAuthed,
    clearAuthed: clearAuthed,
    checkPassword: checkPassword,
    showGate: showGate,
  };
})(window);
