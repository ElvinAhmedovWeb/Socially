/* script.js
   UI controller for index.html
   - modal open/close, focus trap, tab switch
   - emit custom events for auth actions:
       "socially:signin" {email,password}
       "socially:signup" {name,email,password}
       "socially:google" {}
       "socially:forgot" {email}
       "socially:logout" {}
   - nav update using localStorage 'socially_user' or custom "socially:authChanged" event
   - chat widget (open/minimize/close), message send emits "socially:sendMessage" {conversationId,text}
   - exposes window.sociallyUI for external control
*/

(function () {
  // helpers
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // DOM refs (some may be present later)
  const navCta = $('#navCta');
  const loginBtn = $('#loginBtn') || $('#openAuthBtn');
  const openChatBtn = $('#openChatBtn');
  const chatWidget = $('#chatWidget');
  const chatBody = $('#chatBody');
  const chatForm = $('#chatForm');
  const chatInput = $('#chatInput');

  // modal refs will be created/moved if page markup different
  let modalRoot = $('#authModal') || null;
  let modalPanel = modalRoot ? modalRoot.querySelector('.modal-panel') : null;
  let tabSignIn = modalRoot ? modalRoot.querySelector('#tabSignIn') : null;
  let tabSignUp = modalRoot ? modalRoot.querySelector('#tabSignUp') : null;
  let signinForm = modalRoot ? modalRoot.querySelector('#signinForm') : null;
  let signupForm = modalRoot ? modalRoot.querySelector('#signupForm') : null;
  let googleSignIn = modalRoot ? modalRoot.querySelector('#googleSignIn') : null;
  let googleSignUp = modalRoot ? modalRoot.querySelector('#googleSignUp') : null;
  let forgotPass = modalRoot ? modalRoot.querySelector('#forgotPass') : null;
  const authErrorEl = modalRoot ? modalRoot.querySelector('#authError') : null;
  const closeAuthBtn = modalRoot ? modalRoot.querySelector('#closeAuth') : null;
  const toSignIn = modalRoot ? modalRoot.querySelector('#toSignIn') : null;

  // state
  let focusTrapElems = [];
  let lastFocusedBeforeOpen = null;
  let currentConversation = null;

  // Utility: dispatch custom event on document
  function emitEvent(name, detail = {}) {
    const ev = new CustomEvent(name, { detail });
    document.dispatchEvent(ev);
  }

  // Local profile helpers
  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem('socially_user') || 'null') || null;
    } catch (e) { return null; }
  }
  function setStoredUser(obj) {
    localStorage.setItem('socially_user', JSON.stringify(obj || {}));
    // also notify others
    emitEvent('socially:authChanged', { user: obj || null });
  }
  function clearStoredUser() {
    localStorage.removeItem('socially_user');
    emitEvent('socially:authChanged', { user: null });
  }

  // NAV update
  function renderNav(user) {
    if (!navCta) return;
    if (user && (user.name || user.email)) {
      const name = user.name || user.email || 'You';
      const avatar = user.avatar || '';
      navCta.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:10px">
          ${avatar ? `<img src="${escapeHtml(avatar)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`
                   : `<div style="width:36px;height:36px;border-radius:50%;background:#eee;display:inline-flex;align-items:center;justify-content:center">${escapeHtml(name.charAt(0)||'U')}</div>`}
          <span style="color:#333">${escapeHtml(name)}</span>
        </span>
        <a href="profile.html" class="ghost" id="profileBtn">Profile</a>
        <a href="chat.html" class="btn" id="chatBtn">Chat</a>
        <a href="#" class="ghost" id="logoutBtn">Log out</a>
      `;
      // attach handlers
      $('#logoutBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        // emit logout event (auth.js can handle)
        emitEvent('socially:logout', {});
        // call global callback if provided
        if (typeof window.sociallySignOut === 'function') {
          try { await window.sociallySignOut(); } catch (e) { console.warn(e); }
        }
        clearStoredUser();
      });
      $('#chatBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleChat(true);
      });
    } else {
      navCta.innerHTML = `<a href="#" class="login-btn" id="loginBtn">Log in</a><a href="#" class="btn">Download</a>`;
      const newLogin = $('#loginBtn');
      if (newLogin) newLogin.addEventListener('click', (ev) => { ev.preventDefault(); openModal('signin'); });
    }
  }

  // escape HTML small helper
  function escapeHtml(str='') {
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  // Modal control
  function ensureModal() {
    if (modalRoot && modalPanel) return;
    modalRoot = modalRoot || document.getElementById('authModal');
    if (!modalRoot) {
      // nothing to do
      return;
    }
    modalPanel = modalRoot.querySelector('.modal-panel');
    tabSignIn = modalRoot.querySelector('#tabSignIn');
    tabSignUp = modalRoot.querySelector('#tabSignUp');
    signinForm = modalRoot.querySelector('#signinForm');
    signupForm = modalRoot.querySelector('#signupForm');
    googleSignIn = modalRoot.querySelector('#googleSignIn');
    googleSignUp = modalRoot.querySelector('#googleSignUp');
    forgotPass = modalRoot.querySelector('#forgotPass');
    closeAuthBtn = modalRoot.querySelector('#closeAuth');
    toSignIn = modalRoot.querySelector('#toSignIn');

    // listeners
    tabSignIn?.addEventListener('click', () => switchTab('signin'));
    tabSignUp?.addEventListener('click', () => switchTab('signup'));
    closeAuthBtn?.addEventListener('click', () => closeModal());
    modalRoot?.addEventListener('click', (e) => { if (e.target === modalRoot) closeModal(); });

    // forms
    signinForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthError();
      const email = signinForm.querySelector('#signinEmail')?.value?.trim() || '';
      const password = signinForm.querySelector('#signinPassword')?.value || '';
      if (!email || !password) return showAuthError('Email və şifrə doldur.');
      // emit event
      emitEvent('socially:signin', { email, password });
      // call global fallback if available
      if (typeof window.sociallySignIn === 'function') {
        try {
          const user = await window.sociallySignIn(email, password);
          if (user) {
            setStoredUser(user);
            closeModal();
            if (user.avatar) window.location.href = 'chat.html'; else window.location.href = 'profile.html';
            return;
          }
        } catch (err) {
          showAuthError(err.message || 'Giriş mümkün olmadı.');
          return;
        }
      }
      // fallback demo: accept any creds and redirect to profile
      setStoredUser({ name: email.split('@')[0], avatar: '' });
      closeModal();
      window.location.href = 'profile.html';
    });

    signupForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthError();
      const name = signupForm.querySelector('#signupName')?.value?.trim() || '';
      const email = signupForm.querySelector('#signupEmail')?.value?.trim() || '';
      const password = signupForm.querySelector('#signupPassword')?.value || '';
      if (!name || !email || !password) return showAuthError('Bütün sahələri doldurun.');
      emitEvent('socially:signup', { name, email, password });
      if (typeof window.sociallySignUp === 'function') {
        try {
          const user = await window.sociallySignUp(name, email, password);
          setStoredUser(user || { name, avatar: '' });
          closeModal();
          window.location.href = 'profile.html';
          return;
        } catch (err) {
          showAuthError(err.message || 'Signup failed');
          return;
        }
      }
      // fallback local create
      setStoredUser({ name, avatar: '' });
      closeModal();
      window.location.href = 'profile.html';
    });

    // google buttons
    googleSignIn?.addEventListener('click', async (e) => {
      e.preventDefault();
      emitEvent('socially:google', {});
      if (typeof window.sociallySignInWithGoogle === 'function') {
        try {
          const user = await window.sociallySignInWithGoogle();
          setStoredUser(user || { name: user?.displayName || '', avatar: user?.photoURL || '' });
          closeModal();
          if (user?.photoURL) window.location.href = 'chat.html'; else window.location.href = 'profile.html';
          return;
        } catch (err) { showAuthError(err.message || 'Google giriş alınmadı'); return; }
      }
      // fallback demo
      const demo = { name: 'GoogleUser', avatar: '' };
      setStoredUser(demo);
      closeModal();
      window.location.href = 'profile.html';
    });
    googleSignUp?.addEventListener('click', () => googleSignIn?.click());

    // forgot
    forgotPass?.addEventListener('click', (e) => {
      e.preventDefault();
      const email = signinForm.querySelector('#signinEmail')?.value?.trim() || '';
      if (!email) return showAuthError('Email daxil et.');
      emitEvent('socially:forgot', { email });
      if (typeof window.sociallySendPasswordReset === 'function') {
        window.sociallySendPasswordReset(email)
          .then(() => showAuthError('Reset link göndərildi. Emailini yoxla.'))
          .catch(err => showAuthError(err.message || 'Failed to send reset'));
      } else {
        showAuthError('Reset link göndərildi (demo).');
      }
    });

    // "have an account?" button
    toSignIn?.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('signin');
    });

    // focus trap handlers
    modalRoot?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModal(); }
      if (e.key === 'Tab') {
        handleModalTabKey(e);
      }
    });
  }

  function openModal(mode = 'signin') {
    ensureModal();
    if (!modalRoot) return;
    lastFocusedBeforeOpen = document.activeElement;
    modalRoot.classList.add('open');
    modalRoot.setAttribute('aria-hidden', 'false');
    switchTab(mode);
    // build focusable list
    focusTrapElems = Array.from(modalRoot.querySelectorAll('a[href],button,textarea,input,select,[tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.disabled && el.offsetParent !== null);
    setTimeout(() => { (focusTrapElems[0] || modalRoot).focus(); }, 40);
  }

  function closeModal() {
    if (!modalRoot) return;
    modalRoot.classList.remove('open');
    modalRoot.setAttribute('aria-hidden', 'true');
    clearAuthError();
    if (lastFocusedBeforeOpen && typeof lastFocusedBeforeOpen.focus === 'function') lastFocusedBeforeOpen.focus();
  }

  function switchTab(mode='signin') {
    ensureModal();
    if (!modalPanel) return;
    const isSignIn = mode === 'signin';
    tabSignIn?.classList.toggle('active', isSignIn);
    tabSignUp?.classList.toggle('active', !isSignIn);
    if (signinForm) signinForm.style.display = isSignIn ? 'block' : 'none';
    if (signupForm) signupForm.style.display = isSignIn ? 'none' : 'block';
    clearAuthError();
  }

  function handleModalTabKey(e) {
    if (!focusTrapElems || focusTrapElems.length === 0) return;
    const first = focusTrapElems[0], last = focusTrapElems[focusTrapElems.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function showAuthError(msg) {
    if (!authErrorEl) return alert(msg);
    authErrorEl.style.display = 'block';
    authErrorEl.textContent = msg;
    authErrorEl.setAttribute('aria-hidden', 'false');
  }
  function clearAuthError() {
    if (!authErrorEl) return;
    authErrorEl.style.display = 'none';
    authErrorEl.textContent = '';
    authErrorEl.setAttribute('aria-hidden', 'true');
  }

  // CHAT WIDGET
  function toggleChat(show) {
    if (!chatWidget) return;
    if (show === undefined) show = true;
    chatWidget.style.display = show ? 'flex' : 'none';
    chatWidget.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (show) {
      // ensure connected / show history via custom event
      const user = getStoredUser();
      if (!user || !user.name) {
        // prefer open login modal
        openModal('signin');
        return;
      }
      // emit event to request history for current convo if any
      emitEvent('socially:chatOpen', { conversationId: currentConversation || 'global' });
    }
  }

  // attach chat widget controls
  (function bindChatControls(){
    $('#minimizeChat')?.addEventListener('click', () => {
      if (!chatWidget) return;
      chatWidget.classList.toggle('minimized');
    });
    $('#closeChat')?.addEventListener('click', () => { if (chatWidget) chatWidget.style.display = 'none'; });
  })();

  // append message to chat body
  function appendChatMessage(isMe, text) {
    if (!chatBody) return;
    const tpl = document.getElementById('tpl-message');
    let el;
    if (tpl && tpl.content) {
      el = tpl.content.cloneNode(true);
      const wrapper = el.querySelector('.msg') || el.querySelector('div');
      wrapper && wrapper.classList.toggle('sent', !!isMe);
      const txt = el.querySelector('.msg-text') || wrapper;
      if (txt) txt.textContent = text;
      chatBody.appendChild(el);
    } else {
      const d = document.createElement('div');
      d.className = 'msg' + (isMe ? ' sent' : '');
      d.textContent = text;
      chatBody.appendChild(d);
    }
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // chat form submit
  if (chatForm) chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const txt = (chatInput?.value || '').trim();
    if (!txt) return;
    // optimistic UI
    appendChatMessage(true, txt);
    chatInput.value = '';
    // emit event; external module should listen and send to server
    const payload = { conversationId: currentConversation || 'global', text: txt };
    emitEvent('socially:sendMessage', payload);
    // call global helper if exists
    if (typeof window.sociallySendMessage === 'function') {
      try { window.sociallySendMessage(payload); } catch (err) { console.warn(err); }
    } else {
      // fallback: store locally
      const stash = JSON.parse(localStorage.getItem('local_chat') || '[]');
      stash.push({ from: 'me', text: txt, ts: Date.now() });
      localStorage.setItem('local_chat', JSON.stringify(stash));
    }
  });

  // recommended start-chat buttons (delegation)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.start-chat');
    if (!btn) return;
    e.preventDefault();
    const peer = btn.getAttribute('data-peer');
    if (peer) {
      currentConversation = `dm_${[getStoredUser()?.name || 'anon', peer].sort().join('_')}`;
      toggleChat(true);
      // request to join convo
      emitEvent('socially:joinConversation', { conversationId: currentConversation, peer });
      if (typeof window.sociallyJoinConversation === 'function') {
        window.sociallyJoinConversation({ conversationId: currentConversation, peer }).catch(err => console.warn(err));
      }
    }
  });

  // listen to external auth change event
  document.addEventListener('socially:authChanged', (e) => {
    const user = e.detail && e.detail.user;
    renderNav(user || getStoredUser());
  });

  // also allow external scripts to notify UI when user logged in/out
  document.addEventListener('socially:loggedIn', (e) => {
    const user = (e.detail && e.detail.user) || getStoredUser();
    setStoredUser(user);
    renderNav(user);
  });

  // allow external modules to append messages to UI
  document.addEventListener('socially:appendMessage', (e) => {
    const m = e.detail || {};
    appendChatMessage(!!(m.fromUid && getStoredUser() && m.fromUid === (getStoredUser().uid || getStoredUser().name)), m.text || '');
  });

  // init on load
  document.addEventListener('DOMContentLoaded', () => {
    ensureModal();
    // bind top-level login button if present
    loginBtn?.addEventListener('click', (e) => { e.preventDefault(); openModal('signin'); });
    openChatBtn?.addEventListener('click', (e) => { e.preventDefault(); const user = getStoredUser(); if (!user) openModal('signin'); else toggleChat(true); });

    // render nav using stored user
    renderNav(getStoredUser());

    // show saved local messages if socket not present
    const stash = JSON.parse(localStorage.getItem('local_chat') || '[]');
    if (stash.length && chatBody) {
      chatBody.innerHTML = '';
      stash.forEach(m => {
        const isMe = m.from === 'me';
        appendChatMessage(isMe, m.text);
      });
    }

    // expose small API for external scripts
    window.sociallyUI = {
      openModal,
      closeModal,
      switchTab,
      renderNav,
      appendChatMessage,
      openChat: () => toggleChat(true),
      closeChat: () => toggleChat(false),
      setUser: (u) => { setStoredUser(u); renderNav(u); },
      clearUser: () => { clearStoredUser(); renderNav(null); }
    };
  });

  // small safe-guard: if another script wants to notify UI of login quickly:
  // it can call document.dispatchEvent(new CustomEvent('socially:loggedIn',{detail:{user:{name:'X',avatar:''}}}));
})();
