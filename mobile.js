
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function toast(message) {
    const el = $('toast');
    if (!el) return;

    el.textContent = message;
    el.classList.add('show');

    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function closeSidebar() {
    $('sidebar')?.classList.remove('open');
    $('sidebarBackdrop')?.classList.remove('show');
  }

  function openSidebar() {
    $('sidebar')?.classList.add('open');
    $('sidebarBackdrop')?.classList.add('show');
  }

  function openSettings() {
    const modal = $('settingsModal');
    if (modal && !modal.open) modal.showModal();
  }

  function activateTab(tab) {
    document.querySelectorAll('.mobile-nav-item').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tab);
    });
  }

  function setupNavigation() {
    const chat = $('mobileChatNav');
    const history = $('mobileHistoryNav');
    const library = $('mobileLibraryNav');
    const settings = $('mobileSettingsNav');

    chat?.addEventListener('click', () => {
      activateTab('chat');
      closeSidebar();
      $('promptInput')?.focus();
    });

    history?.addEventListener('click', () => {
      activateTab('history');
      openSidebar();
    });

    library?.addEventListener('click', () => {
      activateTab('library');
      toast('Библиотека файлов — следующий этап разработки.');
    });

    settings?.addEventListener('click', () => {
      activateTab('settings');
      openSettings();
    });

    $('chatNav')?.addEventListener('click', () => activateTab('chat'));
    $('libraryNav')?.addEventListener('click', () => activateTab('library'));
  }

  function setupAvatar() {
    const image = document.querySelector('.profile-avatar img');
    if (!image) return;

    image.addEventListener('error', () => {
      image.style.display = 'none';
      image.parentElement.classList.add('avatar-fallback');
      image.parentElement.textContent = 'A';
    });
  }

  function setupDialogs() {
    document.querySelectorAll('dialog.modal').forEach(dialog => {
      dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
      });
    });
  }

  function setupModelPicker() {
    const picker = $('modelPicker');
    const dropdown = $('modelDropdown');

    if (!picker || !dropdown) return;

    picker.addEventListener('click', () => {
      requestAnimationFrame(() => {
        picker.setAttribute(
          'aria-expanded',
          String(!dropdown.hidden)
        );
      });
    });
  }

  function setupReasoningPicker() {
    const picker = $('reasoningButton');
    const dropdown = $('reasoningDropdown');

    if (!picker || !dropdown) return;

    picker.addEventListener('click', () => {
      requestAnimationFrame(() => {
        picker.setAttribute(
          'aria-expanded',
          String(!dropdown.hidden)
        );
      });
    });
  }

  function setupComposer() {
    const input = $('promptInput');
    const send = $('sendButton');

    if (!input || !send) return;

    input.addEventListener('input', () => {
      send.classList.toggle('ready', Boolean(input.value.trim()));
    });
  }

  function init() {
    setupNavigation();
    setupAvatar();
    setupDialogs();
    setupModelPicker();
    setupReasoningPicker();
    setupComposer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
