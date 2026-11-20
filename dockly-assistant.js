/**
 * Dockly AI Installation Assistant & Visual Tutor
 * American Muscle Docks & Fabrication
 */

(() => {
  'use strict';

  const STORAGE_KEY_AUTOSPEAK = 'dockly_auto_speak';

  // AI and voice run through server-side relays (netlify/functions). No API keys exist in browser code.
  const RELAY_CHAT_URL = '/api/docky-chat';
  const RELAY_SPEAK_URL = '/api/docky-speak';
  const RELAY_STATUS_URL = '/api/docky-status';
  const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024; // keeps the base64 upload under the relay limit

  // Remove keys that older versions of this page stored in the browser
  ['dockly_gemini_api_key', 'dockly_gemini_model', 'dockly_eleven_api_key', 'dockly_eleven_voice_id', 'dockly_chat_history'].forEach((k) => {
    try { localStorage.removeItem(k); } catch (e) {}
  });

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // DOM Elements
  const launcher = document.getElementById('dockly-launcher');
  const chatPanel = document.getElementById('dockly-panel');
  const closeBtn = document.getElementById('dockly-close-btn');
  const messagesContainer = document.getElementById('dockly-messages');
  const chatForm = document.getElementById('dockly-form');
  const inputField = document.getElementById('dockly-input');
  const fileInput = document.getElementById('dockly-file-input');
  const cameraInput = document.getElementById('dockly-camera-input');
  const fileAttachBtn = document.getElementById('dockly-attach-btn');
  const cameraBtn = document.getElementById('dockly-camera-btn');
  const micBtn = document.getElementById('dockly-mic-btn');
  const attachmentPreview = document.getElementById('dockly-attachment-preview');
  const settingsBtn = document.getElementById('dockly-settings-btn');
  const settingsDialog = document.getElementById('dockly-settings-dialog');
  const settingsCloseBtn = document.getElementById('dockly-settings-close');
  const settingsSaveBtn = document.getElementById('dockly-settings-save');
  const autoSpeakCheck = document.getElementById('dockly-auto-speak');
  const clearChatBtn = document.getElementById('dockly-clear-chat');
  const docklyStatus = document.getElementById('dockly-status-badge');
  const headerStopBtn = document.getElementById('dockly-header-stop-btn');
  const voiceBanner = document.getElementById('dockly-voice-banner');
  const bannerStopBtn = document.getElementById('dockly-banner-stop-btn');

  // State
  let currentAttachment = null; // { type: 'image'|'video', dataUrl: string, mimeType: string, base64: string, name: string }
  let isListening = false;
  let speechRecognition = null;
  let currentAudio = null;
  let isSpeaking = false;
  let currentSpeakingBtn = null;
  let currentUtterance = null;
  let currentSpeechSessionId = 0;
  let speechPendingTimeout = null;
  // Filled from /api/docky-status. Defaults to offline mode until the relay confirms it is configured.
  const relayStatus = { ai: false, voice: false, autoSpeak: false };

  // 1. Initialize State & Settings
  function initSettings() {
    const autoSpeakDefault = typeof DOCKLY_CONFIG !== 'undefined' && DOCKLY_CONFIG.AUTO_SPEAK_RESPONSES;
    if (autoSpeakCheck) {
      const savedAuto = storageGet(STORAGE_KEY_AUTOSPEAK);
      autoSpeakCheck.checked = savedAuto !== null ? savedAuto === 'true' : Boolean(autoSpeakDefault);
    }

    if (typeof DOCKLY_CONFIG !== 'undefined' && DOCKLY_CONFIG.HIDE_SETTINGS_FOR_INSTALLERS) {
      if (settingsBtn) settingsBtn.style.display = 'none';
    }

    updateStatusBadge();
    refreshRelayStatus();
  }

  async function refreshRelayStatus() {
    try {
      const response = await fetch(RELAY_STATUS_URL, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      relayStatus.ai = Boolean(data.ai);
      relayStatus.voice = Boolean(data.voice);
      relayStatus.autoSpeak = Boolean(data.autoSpeak);
      if (autoSpeakCheck && storageGet(STORAGE_KEY_AUTOSPEAK) === null && relayStatus.autoSpeak) {
        autoSpeakCheck.checked = true;
      }
    } catch (e) {
      // Static hosting without functions (e.g. local preview): stay in built-in expert mode
      relayStatus.ai = false;
      relayStatus.voice = false;
    }
    updateStatusBadge();
  }

  function updateStatusBadge() {
    if (!docklyStatus) return;
    if (relayStatus.ai) {
      docklyStatus.textContent = 'AI Vision Active';
      docklyStatus.className = 'dockly-status-badge active';
      docklyStatus.title = 'Live Multimodal AI Connected';
    } else {
      docklyStatus.textContent = 'Built-in Expert Mode';
      docklyStatus.className = 'dockly-status-badge offline';
      docklyStatus.title = 'Offline Manual Expert Mode';
    }
  }

  // 2. Panel Open / Close
  function togglePanel(open) {
    const isOpen = open !== undefined ? open : chatPanel.classList.toggle('open');
    if (isOpen) {
      chatPanel.classList.add('open');
      chatPanel.setAttribute('aria-hidden', 'false');
      launcher.classList.add('active');
      inputField.focus();
      scrollToBottom();
    } else {
      chatPanel.classList.remove('open');
      chatPanel.setAttribute('aria-hidden', 'true');
      launcher.classList.remove('active');
      stopSpeaking();
    }
  }

  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  // 3. Message Rendering & Deep-linking
  function appendMessage(sender, text, attachment = null, speak = false) {
    const msgEl = document.createElement('div');
    msgEl.className = `dockly-msg ${sender}`;

    const inner = document.createElement('div');
    inner.className = 'dockly-msg-inner';

    if (sender === 'bot') {
      const avatar = document.createElement('img');
      avatar.src = 'images/captain-docky.png';
      avatar.alt = 'Docky';
      avatar.className = 'dockly-msg-avatar';
      msgEl.appendChild(avatar);
    }

    // Attachment thumbnail if present
    if (attachment) {
      const attachCard = document.createElement('div');
      attachCard.className = 'dockly-msg-attachment';
      if (attachment.type === 'video') {
        const video = document.createElement('video');
        video.src = attachment.dataUrl;
        video.controls = true;
        attachCard.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = attachment.dataUrl;
        img.alt = 'Uploaded inspection media';
        img.addEventListener('click', () => {
          if (window.openImageDialog) {
            window.openImageDialog(img);
          }
        });
        attachCard.appendChild(img);
      }
      inner.appendChild(attachCard);
    }

    // Content body
    const body = document.createElement('div');
    body.className = 'dockly-msg-text';
    body.innerHTML = formatMarkdownAndLinks(text);
    inner.appendChild(body);

    // Audio Listen Button for Bot Messages
    if (sender === 'bot') {
      const actionsBar = document.createElement('div');
      actionsBar.className = 'dockly-msg-actions';

      const audioBtn = document.createElement('button');
      audioBtn.type = 'button';
      audioBtn.className = 'dockly-audio-btn';
      updateAudioButtonState(audioBtn, false);

      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (audioBtn.classList.contains('playing')) {
          stopSpeaking();
        } else if (isSpeaking) {
          stopSpeaking();
          speakText(cleanTextForSpeech(text), audioBtn);
        } else {
          speakText(cleanTextForSpeech(text), audioBtn);
        }
      });

      actionsBar.appendChild(audioBtn);
      inner.appendChild(actionsBar);

      // Auto speak if enabled
      if (speak && autoSpeakCheck && autoSpeakCheck.checked) {
        speakText(cleanTextForSpeech(text), audioBtn);
      }
    }

    // Allow user to click anywhere on a speaking message bubble to stop speech instantly
    msgEl.addEventListener('click', (e) => {
      if (e.target.closest('.dockly-page-link') || e.target.closest('img') || e.target.closest('video') || e.target.closest('button')) {
        return;
      }
      if (isSpeaking) {
        stopSpeaking();
      }
    });

    msgEl.appendChild(inner);
    messagesContainer.appendChild(msgEl);
    scrollToBottom();

    // Attach deep link handlers
    attachPageLinkHandlers(msgEl);

    return msgEl;
  }

  function updateAudioButtonState(btn, isPlaying) {
    if (!btn) return;
    if (isPlaying) {
      btn.classList.add('playing');
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="2"></rect>
        </svg>
        <span>Stop Speaking</span>
      `;
      btn.title = 'Stop speaking (Click to mute)';
    } else {
      btn.classList.remove('playing');
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
        <span>Listen</span>
      `;
      btn.title = 'Listen to Docky (Deep Voice)';
    }
  }

  function appendTypingIndicator() {
    const msgEl = document.createElement('div');
    msgEl.className = 'dockly-msg bot typing';
    msgEl.id = 'dockly-typing';

    const avatar = document.createElement('img');
    avatar.src = 'images/captain-docky.png';
    avatar.alt = 'Docky';
    avatar.className = 'dockly-msg-avatar';
    msgEl.appendChild(avatar);

    const inner = document.createElement('div');
    inner.className = 'dockly-msg-inner';
    inner.innerHTML = `
      <div class="dockly-typing-dots">
        <span></span><span></span><span></span>
      </div>
      <small class="dockly-typing-label">Docky is inspecting your manual &amp; media...</small>
    `;
    msgEl.appendChild(inner);
    messagesContainer.appendChild(msgEl);
    scrollToBottom();
    return msgEl;
  }

  function removeTypingIndicator() {
    const typing = document.getElementById('dockly-typing');
    if (typing) typing.remove();
  }

  // 4. Format Markdown & Deep-linking tags
  function formatMarkdownAndLinks(text) {
    if (!text) return '';

    // Escape everything first: AI output is untrusted and must never inject markup
    let html = escapeHtml(text);

    // Replace [[Page X: Title|#page-X]] with page navigation buttons (only real page anchors are accepted)
    html = html.replace(/\[\[(.*?)\|(.*?)\]\]/g, (match, label, pageId) => {
      const cleanId = pageId.replace('#', '').trim();
      if (!/^page-\d{1,2}$/.test(cleanId) || !document.getElementById(cleanId)) return label;
      return `<button type="button" class="dockly-page-link" data-page="${cleanId}">📖 ${label}</button>`;
    });

    // Format [Link Text](https://...) as target="_blank" rel="noopener noreferrer"
    html = html.replace(/\[([^\]]+)\]\((https:\/\/[^\s\)"'<>]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Bold text **bold**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Bullet points
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

    // Paragraph line breaks
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  function cleanTextForSpeech(text) {
    if (!text) return '';
    return text
      .replace(/\[\[(.*?)\|.*?\]\]/g, '$1')
      .replace(/\*\*/g, '')
      .replace(/#+/g, '')
      .replace(/[-*]/g, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  function attachPageLinkHandlers(container) {
    const links = container.querySelectorAll('.dockly-page-link');
    links.forEach((btn) => {
      btn.addEventListener('click', () => {
        const pageId = btn.dataset.page;
        const target = document.getElementById(pageId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          target.classList.add('highlight-target');
          setTimeout(() => target.classList.remove('highlight-target'), 2000);
          if (window.innerWidth < 768) {
            togglePanel(false);
          }
        }
      });
    });
  }

  // 5. Speech Synthesis (Deep Dockmaster Voice) & ElevenLabs
  function speakText(text, buttonEl = null) {
    // 1. Immediately halt all active audio and cancel queued speeches
    stopSpeaking();

    const sessionId = ++currentSpeechSessionId;
    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) return;

    if (relayStatus.voice) {
      speakWithElevenLabs(cleanText, buttonEl, sessionId);
      return;
    }

    // Default: Browser Web Speech API
    speakWithWebSpeech(cleanText, buttonEl, sessionId);
  }

  function speakWithWebSpeech(cleanText, buttonEl, sessionId) {
    if (!('speechSynthesis' in window)) return;

    // Small delay ensures previous speech cancel IPC has resolved completely in Chromium
    speechPendingTimeout = setTimeout(() => {
      if (sessionId !== currentSpeechSessionId) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.pitch = 0.75; // Deep male pitch
      utterance.rate = 0.95;  // Deliberate dockmaster tempo

      const voices = window.speechSynthesis.getVoices();
      // Prioritize deep natural English male voices
      const preferredVoice = voices.find((v) =>
        (v.lang.startsWith('en') && (v.name.includes('David') || v.name.includes('Guy') || v.name.includes('George') || v.name.includes('Male') || v.name.includes('Natural') || v.name.includes('Brian')))
      ) || voices.find((v) => v.lang.startsWith('en'));

      if (preferredVoice) utterance.voice = preferredVoice;

      currentUtterance = utterance;
      isSpeaking = true;
      currentSpeakingBtn = buttonEl;

      // Update UI components
      updateAudioButtonState(buttonEl, true);
      if (headerStopBtn) headerStopBtn.style.display = 'inline-flex';
      if (voiceBanner) voiceBanner.style.display = 'flex';

      const parentMsg = buttonEl ? buttonEl.closest('.dockly-msg') : null;
      if (parentMsg) parentMsg.classList.add('is-speaking');

      utterance.onend = () => {
        if (currentSpeechSessionId === sessionId) {
          stopSpeaking();
        }
      };

      utterance.onerror = () => {
        if (currentSpeechSessionId === sessionId) {
          stopSpeaking();
        }
      };

      // If browser synthesis is paused, resume before speaking
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (e) {}

      window.speechSynthesis.speak(utterance);
    }, 60);
  }

  async function speakWithElevenLabs(text, buttonEl, sessionId) {
    try {
      isSpeaking = true;
      currentSpeakingBtn = buttonEl;
      updateAudioButtonState(buttonEl, true);
      if (headerStopBtn) headerStopBtn.style.display = 'inline-flex';
      if (voiceBanner) voiceBanner.style.display = 'flex';

      const parentMsg = buttonEl ? buttonEl.closest('.dockly-msg') : null;
      if (parentMsg) parentMsg.classList.add('is-speaking');

      const response = await fetch(RELAY_SPEAK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (sessionId !== currentSpeechSessionId) return; // Cancelled during fetch

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`ElevenLabs TTS HTTP ${response.status}: ${errText}`);
      }

      const blob = await response.blob();
      if (sessionId !== currentSpeechSessionId) return; // Cancelled

      const audioUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(audioUrl);
      
      currentAudio.onended = () => {
        if (sessionId === currentSpeechSessionId) stopSpeaking();
      };
      currentAudio.onerror = () => {
        if (sessionId === currentSpeechSessionId) stopSpeaking();
      };

      await currentAudio.play();
    } catch (e) {
      if (sessionId === currentSpeechSessionId) {
        console.warn('ElevenLabs fallback to Web Speech:', e);
        speakWithWebSpeech(text, buttonEl, sessionId);
      }
    }
  }

  function stopSpeaking() {
    currentSpeechSessionId++; // Invalidate any active speech or in-flight fetch
    if (speechPendingTimeout) {
      clearTimeout(speechPendingTimeout);
      speechPendingTimeout = null;
    }

    isSpeaking = false;
    currentSpeakingBtn = null;

    if (currentUtterance) {
      currentUtterance.onend = null;
      currentUtterance.onerror = null;
      currentUtterance = null;
    }

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.src = '';
      } catch (e) {}
      currentAudio = null;
    }

    // Reset all audio buttons and message speaking styles
    document.querySelectorAll('.dockly-audio-btn').forEach((btn) => {
      updateAudioButtonState(btn, false);
    });
    document.querySelectorAll('.dockly-msg.is-speaking').forEach((msg) => {
      msg.classList.remove('is-speaking');
    });

    if (headerStopBtn) {
      headerStopBtn.style.display = 'none';
    }
    if (voiceBanner) {
      voiceBanner.style.display = 'none';
    }
  }

  // 6. Speech Recognition (Speech-to-Text)
  function initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      if (micBtn) {
        micBtn.style.display = 'none';
      }
      return;
    }

    speechRecognition = new SpeechRec();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';

    speechRecognition.onstart = () => {
      isListening = true;
      if (micBtn) micBtn.classList.add('recording');
      inputField.placeholder = 'Listening to you, matey...';
    };

    speechRecognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      inputField.value = transcript;
    };

    speechRecognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      stopListening();
    };

    speechRecognition.onend = () => {
      stopListening();
      if (inputField.value.trim().length > 0) {
        handleUserSubmit();
      }
    };
  }

  function toggleListening() {
    if (!speechRecognition) return;
    if (isListening) {
      speechRecognition.stop();
    } else {
      stopSpeaking();
      inputField.value = '';
      speechRecognition.start();
    }
  }

  function stopListening() {
    isListening = false;
    if (micBtn) micBtn.classList.remove('recording');
    inputField.placeholder = 'Ask Dockly or upload dock photo/video...';
  }

  // 7. Media Attachments (Photo & Video Processing)
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      alert('Please upload an image (JPG, PNG) or short video clip.');
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      event.target.value = '';
      appendMessage('bot', 'That file is too large to inspect. Please upload a photo or a short video clip under **3 MB**.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const base64 = dataUrl.split(',')[1];
      currentAttachment = {
        type: isVideo ? 'video' : 'image',
        dataUrl,
        mimeType: file.type,
        base64,
        name: file.name
      };
      renderAttachmentPreview();
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // Reset file input
  }

  function renderAttachmentPreview() {
    attachmentPreview.innerHTML = '';
    if (!currentAttachment) {
      attachmentPreview.classList.remove('has-file');
      return;
    }

    attachmentPreview.classList.add('has-file');
    const chip = document.createElement('div');
    chip.className = 'dockly-preview-chip';

    if (currentAttachment.type === 'video') {
      chip.innerHTML = `
        <span class="preview-icon">🎬</span>
        <span class="preview-name">${escapeHtml(currentAttachment.name || 'Video Clip')}</span>
        <button type="button" class="preview-remove" aria-label="Remove attachment">✕</button>
      `;
    } else {
      chip.innerHTML = `
        <img src="${currentAttachment.dataUrl}" alt="Preview" class="preview-thumb">
        <span class="preview-name">${escapeHtml(currentAttachment.name || 'Dock Photo')}</span>
        <button type="button" class="preview-remove" aria-label="Remove attachment">✕</button>
      `;
    }

    chip.querySelector('.preview-remove').addEventListener('click', () => {
      currentAttachment = null;
      renderAttachmentPreview();
    });

    attachmentPreview.appendChild(chip);
  }

  // 8. AI relay (server-side Gemini call; see netlify/functions/docky-chat.mjs)
  async function callAiRelay(userQuery, attachment) {
    const payload = { query: userQuery || '', lang: (document.documentElement.lang || 'en').slice(0, 2) };
    if (attachment && attachment.base64) {
      payload.attachment = { mimeType: attachment.mimeType, base64: attachment.base64 };
    }

    const response = await fetch(RELAY_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.reply) {
      if (response.status === 503) relayStatus.ai = false;
      throw new Error(data.error || `Relay error ${response.status}`);
    }
    return data.reply;
  }

  // 9. Built-in Offline Expert Engine (Rule & Scenario Matcher)
  function runOfflineDiagnostics(userQuery, attachment) {
    const q = (userQuery || '').toLowerCase();

    // If an image was attached without specific text, provide a comprehensive visual inspection checklist
    if (attachment && (!userQuery || userQuery.trim().length === 0)) {
      return `I received your installation photo (**${attachment.name || 'Dock Photo'}**). Here is an inspection checklist from the manual:

- **1. Platform spacing**: Both floating platforms roughly **3' apart**, with the sides carrying the **pre-drilled center holes for the grab-bar facing each other**. See [[Page 5: Step One, Attach The Aluminum Pipe Supports|#page-5]].
- **2. Pipe supports**: Laid inside (on top) of the **"V's"**, bolted with **3/8 x 4" stainless bolts**, greased threads, inserted from the **bottom of the V with the nut on top**, all (8) loose until step 3. See [[Page 5: Step One, Attach The Aluminum Pipe Supports|#page-5]].
- **3. Sq. tube stabilizers**: Rubber V-roller at each **inside end** between the two dock sections, **(4) 3/8 x 3" bolts**, finger tight until step 3. See [[Page 6: Step Two, Attach The Sq. Tube Stabilizers|#page-6]].
- **4. Grab-bar**: Dead **center** of the inside of the two platforms, **(1) 3/8 x 5" all-thread bolt** per bracket from the top and **(1) 3/8 x 1.5"** from the sides, then everything from steps 1-3 tightened. See [[Page 7: Step Three, Install The Aluminum Grab-Bar|#page-7]].
- **5. Kandy Kane brackets**: Receivers straddling the outside **2x4" sleeper board**, deck plates mounted **as far out to the edge of the decking as possible** so there is a gap between the pipe and the decking. See [[Page 8: Step Four, Mount The Kandy Kane Pipe Receivers & Brackets|#page-8]].

*(Tip: You can also ask me specific questions about bolt sizes, roller height for your kayak, or the Kandy Kane bracket gap!)*`;
    }

    // Match keywords from OFFLINE_DIAGNOSTICS
    if (typeof OFFLINE_DIAGNOSTICS !== 'undefined') {
      for (const diag of OFFLINE_DIAGNOSTICS) {
        if (diag.keywords.some((kw) => q.includes(kw))) {
          let reply = `${diag.response}\n\n`;
          if (diag.clarification) {
            reply += `**💬 Follow-Up / Details Needed:**\n*${diag.clarification}*\n\n`;
          }
          if (diag.actionLink) {
            reply += `[[${diag.actionLink.text}|#${diag.actionLink.pageId}]]`;
          }
          return reply.trim();
        }
      }
    }

    // Default smart fallback with parts & quick links
    return `Here is the four step installation overview for the Mr. Kayak Launch Dock:

- **Step 1 (Page 5)**: Attach the aluminum pipe supports. Platforms roughly 3' apart, supports bolted into the "V's" with 3/8 x 4" stainless bolts, all (8) left loose.
- **Step 2 (Page 6)**: Attach the sq. tube stabilizers with the rubber V-rollers to each inside end, (4) 3/8 x 3" bolts, finger tight.
- **Step 3 (Page 7)**: Install the aluminum grab-bar dead center, (1) 3/8 x 5" all-thread bolt per bracket from the top and (1) 3/8 x 1.5" from the sides, then tighten everything from steps 1-3.
- **Step 4 (Page 8)**: Mount the Kandy Kane pipe receivers and deck brackets.

**💬 Could you provide a few more details so I can give you the exact steps?**
*(For example: which step are you on? Are you asking about bolt sizes, roller height for your kayak, or mounting the Kandy Kane brackets to your dock?)*

[[Page 4: Four Step Installation & Tools Needed|#page-4]]`;
  }

  // 10. Handle Form Submission
  async function handleUserSubmit() {
    stopSpeaking();
    const text = inputField.value.trim();
    const attachment = currentAttachment;

    if (!text && !attachment) return;

    // Clear input & preview
    inputField.value = '';
    currentAttachment = null;
    renderAttachmentPreview();

    // Render User Message
    appendMessage('user', text || '(Uploaded media for inspection)', attachment);

    // Render Typing Indicator
    appendTypingIndicator();

    try {
      let botResponse = '';
      if (relayStatus.ai) {
        botResponse = await callAiRelay(text, attachment);
      } else {
        // Built-in expert mode
        await new Promise((r) => setTimeout(r, 600)); // natural reading pause
        botResponse = runOfflineDiagnostics(text, attachment);
      }

      removeTypingIndicator();
      appendMessage('bot', botResponse, null, true);
    } catch (err) {
      console.error('Dockly processing error:', err);
      removeTypingIndicator();

      updateStatusBadge();
      // Graceful fallback to offline engine if the relay fails
      const fallbackResponse = runOfflineDiagnostics(text, attachment);
      appendMessage('bot', fallbackResponse, null, true);
    }
  }

  // 11. Event Listeners & Binding
  function bindEvents() {
    launcher.addEventListener('click', () => togglePanel());
    closeBtn.addEventListener('click', () => togglePanel(false));

    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleUserSubmit();
    });

    fileAttachBtn.addEventListener('click', () => fileInput.click());
    if (cameraBtn) cameraBtn.addEventListener('click', () => cameraInput.click());

    fileInput.addEventListener('change', handleFileSelect);
    if (cameraInput) cameraInput.addEventListener('change', handleFileSelect);

    if (micBtn) {
      initSpeechRecognition();
      micBtn.addEventListener('click', toggleListening);
    }

    if (headerStopBtn) {
      headerStopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopSpeaking();
      });
    }

    if (bannerStopBtn) {
      bannerStopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopSpeaking();
      });
    }

    if (voiceBanner) {
      voiceBanner.addEventListener('click', (e) => {
        e.stopPropagation();
        stopSpeaking();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isSpeaking) {
        stopSpeaking();
      }
    });

    // Interactive Quick Topic Buttons Delegation
    messagesContainer.addEventListener('click', (e) => {
      const topicBtn = e.target.closest('.dockly-topic-btn');
      if (topicBtn) {
        e.stopPropagation();
        stopSpeaking();
        const query = topicBtn.dataset.prompt || topicBtn.querySelector('.topic-btn-title')?.textContent || '';
        if (query) {
          inputField.value = query;
          handleUserSubmit();
        }
      }
    });

    // Settings Modal
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        settingsDialog.showModal();
      });
    }

    if (settingsCloseBtn) {
      settingsCloseBtn.addEventListener('click', () => {
        settingsDialog.close();
      });
    }

    if (settingsSaveBtn) {
      settingsSaveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        storageSet(STORAGE_KEY_AUTOSPEAK, String(autoSpeakCheck.checked));
        updateStatusBadge();
        settingsDialog.close();
      });
    }

    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', () => {
        messagesContainer.innerHTML = '';
        appendInitialGreeting();
      });
    }

    // Close settings on outside click
    if (settingsDialog) {
      settingsDialog.addEventListener('click', (e) => {
        if (e.target === settingsDialog) settingsDialog.close();
      });
    }
  }

  function appendInitialGreeting() {
    const greetingText = `Welcome to the **Mr. Kayak Launch Dock AI Installation Guide**! I'm **Docky**, your technical assistant trained directly on the American Muscle Docks installation manual.

How I can assist you:
- **Photo & Video Inspection**: Click **(+)** or **📷** to upload photos of your platforms, pipe supports, grab-bar, or Kandy Kane brackets for an instant check against the manual.
- **Step-by-Step Instructions**: Ask any question about the four steps, bolt sizes and quantities, roller height, or dimensions.
- **Voice Speech**: Tap the **Mic** to speak hands-free, or click **Listen** on any response to hear the step read out loud.

Select a common question below or ask me anything:`;

    const msgEl = appendMessage('bot', greetingText);

    // Append the interactive quick action topic cards cleanly inside this welcome bubble
    const inner = msgEl ? msgEl.querySelector('.dockly-msg-inner') : null;
    if (inner) {
      const topicsContainer = document.createElement('div');
      topicsContainer.className = 'dockly-welcome-topics';
      topicsContainer.innerHTML = `
        <div class="dockly-topics-heading">
          <span>Tap to ask Docky:</span>
        </div>
        <div class="dockly-topics-grid">
          <button type="button" class="dockly-topic-btn" data-prompt="What bolts do I use for the aluminum pipe supports and which way do they go in?">
            <span class="topic-btn-icon">🔩</span>
            <div class="topic-btn-body">
              <span class="topic-btn-title">Step 1: Pipe Supports</span>
              <span class="topic-btn-desc">Bolt size, grease &amp; which way they go in</span>
            </div>
            <span class="topic-btn-arrow">&rarr;</span>
          </button>
          <button type="button" class="dockly-topic-btn" data-prompt="My kayak sits too loose on the rubber rollers. Can I move the stabilizer bracket?">
            <span class="topic-btn-icon">🛶</span>
            <div class="topic-btn-body">
              <span class="topic-btn-title">Roller Height For My Kayak</span>
              <span class="topic-btn-desc">Adjusting the V-roller bracket up or down</span>
            </div>
            <span class="topic-btn-arrow">&rarr;</span>
          </button>
          <button type="button" class="dockly-topic-btn" data-prompt="The grab-bar holes do not line up with the platforms. What do I do?">
            <span class="topic-btn-icon">📏</span>
            <div class="topic-btn-body">
              <span class="topic-btn-title">Grab-Bar Won’t Line Up</span>
              <span class="topic-btn-desc">Centering it and fastening both bolts</span>
            </div>
            <span class="topic-btn-arrow">&rarr;</span>
          </button>
          <button type="button" class="dockly-topic-btn" data-prompt="How do I mount the Kandy Kane pipe receivers and deck brackets?">
            <span class="topic-btn-icon">🛠️</span>
            <div class="topic-btn-body">
              <span class="topic-btn-title">Kandy Kane Brackets</span>
              <span class="topic-btn-desc">Carriage bolts, drill angle &amp; the gap</span>
            </div>
            <span class="topic-btn-arrow">&rarr;</span>
          </button>
          <button type="button" class="dockly-topic-btn" data-prompt="What tools do I need and what is in the kit before I start?">
            <span class="topic-btn-icon">🧰</span>
            <div class="topic-btn-body">
              <span class="topic-btn-title">Tools &amp; Kit Contents</span>
              <span class="topic-btn-desc">Wrench, drill bit &amp; every bolt bag</span>
            </div>
            <span class="topic-btn-arrow">&rarr;</span>
          </button>
          <button type="button" class="dockly-topic-btn" data-prompt="What are the overall dimensions of the Mr. Kayak Launch Dock?">
            <span class="topic-btn-icon">📐</span>
            <div class="topic-btn-body">
              <span class="topic-btn-title">Dimensions</span>
              <span class="topic-btn-desc">Width, length, grab-bar &amp; deck height</span>
            </div>
            <span class="topic-btn-arrow">&rarr;</span>
          </button>
        </div>
      `;

      const actionsBar = inner.querySelector('.dockly-msg-actions');
      if (actionsBar) {
        inner.insertBefore(topicsContainer, actionsBar);
      } else {
        inner.appendChild(topicsContainer);
      }
    }
  }

  // Initialize Dockly
  initSettings();
  bindEvents();
  appendInitialGreeting();
})();
