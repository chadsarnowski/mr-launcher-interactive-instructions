(() => {
  'use strict';

  // Storage can throw (private browsing, blocked site data); never let that break the manual
  const store = {
    getItem(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    setItem(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  };

  const STORAGE_THEME = 'mrLauncherTheme';
  const STORAGE_SIZE = 'mrLauncherTextSize';
  const STORAGE_TOOLS = 'mrLauncherTools';
  const STORAGE_SAFETY = 'mrLauncherSafetyAck';
  const STORAGE_LANG = 'mr_launcher_lang';

  // Runtime interface text for each language page (static page text is translated at build time)
  const UI_STRINGS = {
    en: { light: 'Light', dark: 'Dark', fit: 'Fit to Screen', full: 'Full Size (100%)', enlarged: 'Enlarged diagram', diagram: 'Diagram', manualDiagram: 'Manual Diagram', enlargeImage: 'Enlarge image', enlargeToFull: 'Enlarge to full size' },
    es: { light: 'Claro', dark: 'Oscuro', fit: 'Ajustar a la pantalla', full: 'Tamaño completo (100%)', enlarged: 'Diagrama ampliado', diagram: 'Diagrama', manualDiagram: 'Diagrama del manual', enlargeImage: 'Ampliar imagen', enlargeToFull: 'Ampliar a tamaño completo' },
    zh: { light: '浅色', dark: '深色', fit: '适应屏幕', full: '原始大小 (100%)', enlarged: '放大的示意图', diagram: '示意图', manualDiagram: '手册示意图', enlargeImage: '放大图片', enlargeToFull: '放大至原始大小' },
    tl: { light: 'Maliwanag', dark: 'Madilim', fit: 'Iakma sa Screen', full: 'Buong Laki (100%)', enlarged: 'Pinalaking diagram', diagram: 'Diagram', manualDiagram: 'Diagram ng Manwal', enlargeImage: 'Palakihin ang larawan', enlargeToFull: 'Palakihin sa buong laki' },
    vi: { light: 'Sáng', dark: 'Tối', fit: 'Vừa màn hình', full: 'Kích thước đầy đủ (100%)', enlarged: 'Sơ đồ phóng to', diagram: 'Sơ đồ', manualDiagram: 'Sơ đồ hướng dẫn', enlargeImage: 'Phóng to hình ảnh', enlargeToFull: 'Phóng to kích thước đầy đủ' }
  };
  const UI = UI_STRINGS[(document.documentElement.lang || 'en').slice(0, 2)] || UI_STRINGS.en;

  const pages = [...document.querySelectorAll('.manual-page')];
  const contentsDrawer = document.getElementById('contents-drawer');
  const contentsLinks = document.getElementById('contents-links');
  const contentsToggle = document.getElementById('contents-toggle');
  const themeToggle = document.getElementById('theme-toggle');
  const langPickerBtn = document.getElementById('lang-picker-btn');
  const langMenu = document.getElementById('lang-menu');
  const currentLangCodeEl = document.getElementById('current-lang-code');
  const langOptions = document.querySelectorAll('.lang-option');
  const progress = document.getElementById('reading-progress');
  const previousButton = document.getElementById('previous-page');
  const nextButton = document.getElementById('next-page');
  const scrollToTopBtn = document.getElementById('scroll-to-top');

  // Modal Dialog Elements
  const dialog = document.getElementById('image-dialog');
  const dialogImage = document.getElementById('dialog-image');
  const dialogCaption = document.getElementById('dialog-caption');
  const dialogZoomToggle = document.getElementById('dialog-zoom-toggle');
  const dialogZoomText = document.getElementById('dialog-zoom-text');
  const dialogCloseBtn = document.getElementById('dialog-close');
  const dialogBody = document.getElementById('dialog-body');

  const safetyAck = document.getElementById('safety-ack-checkbox');
  const sizeButtons = document.querySelectorAll('.size-btn');

  let currentPage = 0;
  let returnFocus = null;
  let isZoomed = false;

  // 1. Theme Setting
  function setTheme(theme, save = true) {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    themeToggle.setAttribute('aria-pressed', String(dark));
    const label = themeToggle.querySelector('.theme-label');
    if (label) label.textContent = dark ? UI.light : UI.dark;
    const icon = themeToggle.querySelector('.theme-icon');
    if (icon) icon.textContent = dark ? '☀' : '◐';
    if (save) store.setItem(STORAGE_THEME, dark ? 'dark' : 'light');
  }

  // 2. Text Size Setting
  function setTextSize(size, save = true) {
    const validSizes = ['standard', 'large', 'xl'];
    const activeSize = validSizes.includes(size) ? size : 'standard';
    document.documentElement.dataset.textSize = activeSize;

    sizeButtons.forEach((btn) => {
      const isSelected = btn.dataset.size === activeSize;
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
    });

    if (save) store.setItem(STORAGE_SIZE, activeSize);
  }

  // 2.5 Language Selector & Local Multi-Language Support
  function getCurrentPageLanguage() {
    // Netlify serves /index-es.html as /index-es (pretty URLs), so match with or without .html
    const page = (window.location.pathname.split('/').pop() || '').toLowerCase().replace(/\.html$/, '');
    const match = page.match(/^index-(es|zh|tl|vi)$/);
    return match ? match[1] : (document.documentElement.lang || 'en').slice(0, 2);
  }

  // The menu is rendered at the end of <body> with fixed positioning so no header styling
  // (sticky position, blur effects, overflow) can clip or hide it on iPhone Safari.
  function positionLanguageMenu() {
    const rect = langPickerBtn.getBoundingClientRect();
    langMenu.style.position = 'fixed';
    langMenu.style.top = `${Math.round(rect.bottom + 6)}px`;
    langMenu.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
    langMenu.style.left = 'auto';
    langMenu.style.zIndex = '5000';
  }

  function setLanguageMenuOpen(open) {
    if (!langPickerBtn || !langMenu) return;
    langPickerBtn.setAttribute('aria-expanded', String(open));
    if (open) positionLanguageMenu();
    langMenu.hidden = !open;
  }

  function setLanguage(langCode, save = true) {
    const code = (langCode || 'en').toLowerCase();
    const currentLang = getCurrentPageLanguage();

    if (save) {
      store.setItem(STORAGE_LANG, code);
    }

    // Update active highlight on menu items
    langOptions.forEach((opt) => {
      const isSelected = opt.dataset.lang === code;
      opt.classList.toggle('active', isSelected);
      opt.setAttribute('aria-selected', String(isSelected));
    });

    if (currentLangCodeEl) {
      currentLangCodeEl.textContent = code.toUpperCase();
    }

    // Route to corresponding translated file
    const targetFile = code === 'en' ? 'index.html' : `index-${code}.html`;
    if (code !== currentLang) {
      const hash = window.location.hash || '';
      window.location.href = targetFile + hash;
      return;
    }

    setLanguageMenuOpen(false);
  }

  function initLanguageSelector() {
    if (!langPickerBtn || !langMenu) return;

    const currentLang = getCurrentPageLanguage();

    if (langMenu.parentElement !== document.body) {
      document.body.appendChild(langMenu);
    }
    window.addEventListener('resize', () => setLanguageMenuOpen(false));
    window.addEventListener('scroll', () => {
      if (langPickerBtn.getAttribute('aria-expanded') === 'true') positionLanguageMenu();
    }, { passive: true });

    langOptions.forEach((opt) => {
      const isSelected = opt.dataset.lang === currentLang;
      opt.classList.toggle('active', isSelected);
      opt.setAttribute('aria-selected', String(isSelected));
    });

    if (currentLangCodeEl) {
      currentLangCodeEl.textContent = currentLang.toUpperCase();
    }
    store.setItem(STORAGE_LANG, currentLang);

    langPickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = langPickerBtn.getAttribute('aria-expanded') === 'true';
      setLanguageMenuOpen(!isOpen);
    });

    langOptions.forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const selectedLang = opt.dataset.lang;
        setLanguage(selectedLang, true);
        setLanguageMenuOpen(false);
        langPickerBtn.focus();
      });
    });

    document.addEventListener('click', (e) => {
      if (!langPickerBtn.contains(e.target) && !langMenu.contains(e.target)) {
        setLanguageMenuOpen(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && langPickerBtn.getAttribute('aria-expanded') === 'true') {
        setLanguageMenuOpen(false);
        langPickerBtn.focus();
      }
    });
  }

  // 3. Contents Drawer
  function setDrawer(open) {
    contentsDrawer.hidden = !open;
    contentsToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      document.getElementById('contents-close').focus();
    }
  }

  function buildContents() {
    const fragment = document.createDocumentFragment();
    pages.forEach((page, index) => {
      const link = document.createElement('a');
      link.href = `#${page.id}`;
      link.dataset.index = String(index);

      const number = document.createElement('span');
      // Show the printed manual page number from the page footer; unnumbered sections stay blank
      const printed = page.querySelector('.page-footer .page-num');
      const printedText = printed ? printed.textContent.trim() : '';
      number.textContent = /^\d+$/.test(printedText) ? printedText.padStart(2, '0') : '';

      const title = document.createElement('span');
      title.textContent = page.dataset.title;

      link.append(number, title);
      link.addEventListener('click', () => setDrawer(false));
      fragment.append(link);
    });
    contentsLinks.append(fragment);
  }

  function updatePage(index) {
    currentPage = Math.max(0, Math.min(pages.length - 1, index));
    if (previousButton) previousButton.disabled = currentPage === 0;
    if (nextButton) nextButton.disabled = currentPage === pages.length - 1;

    contentsLinks.querySelectorAll('a').forEach((link) => {
      const active = Number(link.dataset.index) === currentPage;
      link.classList.toggle('active', active);
      if (active) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function goToPage(index) {
    const targetIdx = Math.max(0, Math.min(pages.length - 1, index));
    const destination = pages[targetIdx];
    destination.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updatePage(targetIdx);
  }

  function updateProgress() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const percent = scrollable > 0 ? Math.max(0, Math.min(100, (window.scrollY / scrollable) * 100)) : 0;
    if (progress) progress.style.width = `${percent}%`;
  }

  function setupPageObserver() {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        updatePage(pages.indexOf(visible.target));
      }
    }, { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.1, 0.4] });

    pages.forEach((page) => observer.observe(page));
  }

  // 4. Modal Image Viewer with 100% Zoom Toggle
  function toggleZoom(force) {
    isZoomed = force !== undefined ? force : !isZoomed;
    dialog.classList.toggle('is-zoomed', isZoomed);
    if (dialogZoomText) {
      dialogZoomText.textContent = isZoomed ? UI.fit : UI.full;
    }
    if (dialogZoomToggle) {
      dialogZoomToggle.classList.toggle('active', isZoomed);
    }
  }

  function openImage(image) {
    returnFocus = image;
    dialogImage.src = image.currentSrc || image.src;
    dialogImage.alt = image.alt || UI.enlarged;
    const figure = image.closest('figure');
    dialogCaption.textContent = figure?.querySelector('figcaption')?.textContent || image.alt || UI.manualDiagram;
    toggleZoom(false);
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    dialogCloseBtn.focus();
  }

  function closeImage() {
    dialog.close();
    document.body.style.overflow = '';
    toggleZoom(false);
    if (returnFocus) returnFocus.focus();
  }

  // Attach Enlarge Buttons & Wrapper Directly to Every Instructional Image
  function setupImageEnlargers() {
    const images = document.querySelectorAll('.manual-page img');
    images.forEach((image) => {
      // Exclude cover page, branding, logos, badges, QR codes, Docky mascot, and winding comparison containers
      const isExcluded = (
        image.closest('.cover-page, .cover-left-panel, .cover-right-panel, .cover-product-wrapper, .cover-badge-wrapper, .closing-page, .closing-visual, .cover-logo, .cover-qr, .cover-badge, .cover-brand-header, .closing-logo, .closing-qr, .support-qr-box, .dark-support-card, .cover-qr-block, .cover-qr-img-wrapper, .mascot-reference, .maintenance-sidebar, .winding-img-container, .no-zoom, [data-no-zoom]') ||
        (image.src && (image.src.toLowerCase().includes('qr') || image.src.toLowerCase().includes('docky') || image.src.toLowerCase().includes('logo'))) ||
        (image.alt && (image.alt.toLowerCase().includes('qr') || image.alt.toLowerCase().includes('logo') || image.alt.toLowerCase().includes('mascot') || image.alt.toLowerCase().includes('docky'))) ||
        (image.classList && (image.classList.contains('cover-product') || image.classList.contains('cover-badge') || image.classList.contains('cover-logo') || image.classList.contains('docky-enjoy-img') || image.classList.contains('no-zoom')))
      );
      if (isExcluded) {
        image.removeAttribute('tabindex');
        image.removeAttribute('role');
        image.removeAttribute('aria-label');
        if (image.closest('.winding-img-container')) {
          image.style.cursor = 'pointer';
          image.tabIndex = 0;
          image.setAttribute('role', 'button');
          image.setAttribute('aria-label', `${UI.enlargeImage}: ${image.alt || UI.diagram}`);
          image.addEventListener('click', () => openImage(image));
          image.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openImage(image);
            }
          });
        }
        return;
      }

      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', `${UI.enlargeImage}: ${image.alt || UI.diagram}`);

      // Ensure image is wrapped in a dedicated relative wrapper so button is directly on image
      let wrapper = image.parentElement;
      if (!wrapper || !wrapper.classList.contains('img-zoom-wrapper')) {
        wrapper = document.createElement('div');
        wrapper.className = 'img-zoom-wrapper';
        if (image.classList.contains('full-diagram')) {
          wrapper.classList.add('full-diagram-wrapper');
        }
        image.parentNode.insertBefore(wrapper, image);
        wrapper.appendChild(image);
      }

      if (!wrapper.querySelector('.btn-enlarge')) {
        const enlargeBtn = document.createElement('button');
        enlargeBtn.type = 'button';
        enlargeBtn.className = 'btn-enlarge';
        enlargeBtn.setAttribute('aria-label', `${UI.enlargeToFull}: ${image.alt || UI.diagram}`);
        enlargeBtn.setAttribute('title', UI.enlargeToFull);
        enlargeBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        `;
        enlargeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openImage(image);
        });
        wrapper.appendChild(enlargeBtn);
      }

      image.addEventListener('click', () => openImage(image));
      image.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openImage(image);
        }
      });
    });
  }

  // 5. Tool Checkbox Persistence
  function initToolCheckboxes() {
    const savedTools = JSON.parse(store.getItem(STORAGE_TOOLS) || '{}');
    const checkboxes = document.querySelectorAll('.interactive-checklist input[type="checkbox"]');

    checkboxes.forEach((cb) => {
      const toolId = cb.dataset.tool;
      if (toolId && savedTools[toolId] !== undefined) {
        cb.checked = savedTools[toolId];
      }

      cb.addEventListener('change', () => {
        if (!toolId) return;
        savedTools[toolId] = cb.checked;
        store.setItem(STORAGE_TOOLS, JSON.stringify(savedTools));
      });
    });
  }

  // 6. Safety Acknowledgment Persistence
  function initSafetyAck() {
    if (!safetyAck) return;
    const savedAck = store.getItem(STORAGE_SAFETY) === 'true';
    safetyAck.checked = savedAck;

    safetyAck.addEventListener('change', () => {
      store.setItem(STORAGE_SAFETY, String(safetyAck.checked));
    });
  }

  // 7. Scroll Handling (Progress & Floating Scroll-To-Top)
  function handleScroll() {
    updateProgress();
    if (scrollToTopBtn) {
      if (window.scrollY > 350) {
        scrollToTopBtn.classList.add('visible');
      } else {
        scrollToTopBtn.classList.remove('visible');
      }
    }
  }

  // Initialization
  buildContents();
  setupPageObserver();
  updatePage(0);
  setupImageEnlargers();
  initToolCheckboxes();
  initSafetyAck();
  initLanguageSelector();
  handleScroll();

  // Load saved preferences
  const savedTheme = store.getItem(STORAGE_THEME) || 'light';
  setTheme(savedTheme, false);

  const savedSize = store.getItem(STORAGE_SIZE) || 'standard';
  setTextSize(savedSize, false);

  // Event Listeners
  themeToggle.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  sizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setTextSize(btn.dataset.size);
    });
  });

  contentsToggle.addEventListener('click', () => setDrawer(contentsDrawer.hidden));
  document.getElementById('contents-close').addEventListener('click', () => setDrawer(false));

  // Bottom floating nav: "Pages" opens the same contents drawer as the header Menu
  const openContentsBtn = document.getElementById('open-contents');
  if (openContentsBtn) {
    openContentsBtn.addEventListener('click', () => setDrawer(contentsDrawer.hidden));
  }
  // The PDF button in the header is a plain link to assets/manuals/, so the browser
  // can open it in a new tab where the reader prints or downloads it. An optional
  // #print-button elsewhere on the page opens the same file.
  const PDF_PATH = 'assets/manuals/Mr-Launcher-2.0-Kayak-Launch-Dock-Installation-Manual-9.16.26.pdf';
  const printBtn = document.getElementById('print-button');
  if (printBtn) {
    printBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(PDF_PATH, '_blank', 'noopener');
    });
  }

  if (previousButton) previousButton.addEventListener('click', () => goToPage(currentPage - 1));
  if (nextButton) nextButton.addEventListener('click', () => goToPage(currentPage + 1));

  if (scrollToTopBtn) {
    scrollToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  window.addEventListener('scroll', handleScroll, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (dialog.hasAttribute('open')) {
        closeImage();
      } else if (!contentsDrawer.hidden) {
        setDrawer(false);
      }
    }
  });

  if (dialogZoomToggle) {
    dialogZoomToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleZoom();
    });
  }

  if (dialogImage) {
    dialogImage.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleZoom();
    });
  }

  // Mouse drag-to-pan in Zoomed Mode
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let scrollLeft = 0;
  let scrollTop = 0;

  if (dialogBody) {
    dialogBody.addEventListener('mousedown', (e) => {
      if (!isZoomed || e.button !== 0) return;
      isDragging = true;
      dialogBody.classList.add('is-dragging');
      startX = e.pageX - dialogBody.offsetLeft;
      startY = e.pageY - dialogBody.offsetTop;
      scrollLeft = dialogBody.scrollLeft;
      scrollTop = dialogBody.scrollTop;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        dialogBody.classList.remove('is-dragging');
      }
    });

    dialogBody.addEventListener('mousemove', (e) => {
      if (!isDragging || !isZoomed) return;
      e.preventDefault();
      const x = e.pageX - dialogBody.offsetLeft;
      const y = e.pageY - dialogBody.offsetTop;
      const walkX = (x - startX) * 1.4;
      const walkY = (y - startY) * 1.4;
      dialogBody.scrollLeft = scrollLeft - walkX;
      dialogBody.scrollTop = scrollTop - walkY;
    });

    dialogBody.addEventListener('click', (event) => {
      if (event.target === dialogBody) {
        closeImage();
      }
    });
  }

  dialogCloseBtn.addEventListener('click', closeImage);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeImage();
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      closeImage();
    }
  });
})();
