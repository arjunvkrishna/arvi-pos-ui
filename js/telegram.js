// NERAM POS - on-demand module: Telegram low-stock notifications
// Loaded the first time one of its functions is used (see "ON-DEMAND CODE" in app.js). Declarations only: no code may run at load.
// Shared state that other files read must be declared in app.js. After editing run: node tools/check-chunks.js --write

// TELEGRAM LOW-STOCK NOTIFICATIONS MODULE (ADMIN ONLY)
// ============================================================
let telegramSettingsState = null;
let telegramRecipientsState = [];
let telegramPreviewState = null;
let activeTelegramLinkData = null;

async function loadTelegramData() {
  if (!currentUser || currentUser.role !== 'ADMIN') return;

  try {
    const [settings, recipients, preview, history] = await Promise.all([
      apiRequest('/admin/telegram/settings'),
      apiRequest('/admin/telegram/recipients'),
      apiRequest('/admin/telegram/preview').catch(() => ({ itemCount: 0, items: [] })),
      apiRequest('/admin/telegram/history').catch(() => [])
    ]);

    telegramSettingsState = settings;
    telegramRecipientsState = recipients;
    telegramPreviewState = preview;

    // Update Global Settings UI
    const toggleEl = document.getElementById('telegramEnabledToggle');
    if (toggleEl) toggleEl.checked = Boolean(settings.enabled);

    const sendTimeEl = document.getElementById('telegramSendTimeInput');
    if (sendTimeEl && settings.dailySendTime) sendTimeEl.value = settings.dailySendTime;

    // Update Status Badges
    const statusBadge = document.getElementById('telegramGlobalStatusBadge');
    if (statusBadge) {
      if (settings.enabled) {
        statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        statusBadge.innerHTML = `<i class="fa-solid fa-circle-check mr-1"></i>Active (${settings.dailySendTime} IST)`;
      } else {
        statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30';
        statusBadge.innerHTML = `<i class="fa-solid fa-circle-xmark mr-1"></i>Disabled`;
      }
    }

    const botBadge = document.getElementById('telegramBotBadge');
    if (botBadge) {
      if (settings.botConfigured) {
        botBadge.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5';
        const tag = settings.botUsername ? `@${settings.botUsername}` : 'Configured';
        botBadge.innerHTML = `<i class="fa-solid fa-robot text-[10px]"></i><span>Bot: ${tag}</span>`;
      } else {
        botBadge.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-900 border border-gray-800 text-gray-500 flex items-center gap-1.5';
        botBadge.innerHTML = `<i class="fa-solid fa-circle text-[8px] text-gray-600"></i><span>Bot: Not Configured (Server .env)</span>`;
      }
    }

    const lastRunEl = document.getElementById('telegramLastRunDate');
    if (lastRunEl) {
      lastRunEl.textContent = 'Last Run: ' + (settings.lastRunDate || 'Never');
    }

    const statLowStock = document.getElementById('telegramStatLowStockCount');
    if (statLowStock) statLowStock.textContent = preview.itemCount || 0;

    const statVerified = document.getElementById('telegramStatVerifiedCount');
    if (statVerified) statVerified.textContent = settings.verifiedRecipientsCount || 0;

    // Render Tables
    renderTelegramRecipientsTable(recipients);
    renderTelegramHistoryTable(history);

  } catch (err) {
    showToast('Failed to load Telegram settings: ' + err.message, 'error');
  }
}

function renderTelegramRecipientsTable(recipients) {
  const tbody = document.getElementById('telegramRecipientsTableBody');
  if (!tbody) return;

  if (!recipients || recipients.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-6 text-center text-gray-500 text-xs">
          No manager accounts found in system. Create manager accounts in Staff &amp; Payroll or User Accounts.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = recipients.map(r => {
    const isVerified = r.status === 'VERIFIED';
    const isPending = r.status === 'PENDING_VERIFICATION';

    let statusPill = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400 border border-gray-700">Not configured</span>`;
    if (isVerified) {
      statusPill = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-max">
        <i class="fa-solid fa-circle-check text-[9px]"></i><span>Verified</span>
      </span>`;
    } else if (isPending) {
      statusPill = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-max">
        <i class="fa-solid fa-clock-rotate-left animate-spin text-[9px]"></i><span>Pending Verification</span>
      </span>`;
    }

    const chatIdDisplay = r.telegramChatIdMasked
      ? `<code class="font-mono text-gray-300 font-bold bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">${escapeHtml(r.telegramChatIdMasked)}</code>`
      : `<span class="text-gray-600 italic">None</span>`;

    const lastTestedDisplay = r.verifiedAt
      ? `<span class="text-gray-300">${new Date(r.verifiedAt).toLocaleDateString()}</span>`
      : r.lastTestSentAt
        ? `<span class="text-gray-400">${new Date(r.lastTestSentAt).toLocaleDateString()}</span>`
        : `<span class="text-gray-600">—</span>`;

    return `
      <tr class="hover:bg-gray-900/40 transition">
        <td class="p-3">
          <div class="font-bold text-white text-xs">${escapeHtml(r.employeeName || r.username)}</div>
          <div class="text-[10px] text-gray-500 flex items-center gap-1.5">
            <span>@${escapeHtml(r.username)}</span>
            ${r.telegramUsername ? `<span class="text-sky-400/90 font-mono">(@${escapeHtml(r.telegramUsername)})</span>` : ''}
          </div>
        </td>
        <td class="p-3 text-center">
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" ${r.selected ? 'checked' : ''} onchange="toggleTelegramRecipient(${r.userId}, this.checked)" class="sr-only peer">
            <div class="w-8 h-4 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </td>
        <td class="p-3">
          ${statusPill}
        </td>
        <td class="p-3">
          <div class="flex items-center space-x-1.5">
            ${chatIdDisplay}
            <button onclick="openTelegramChatIdModal(${r.userId}, '${escapeHtml(r.employeeName || r.username)}', '${r.telegramChatId || ''}')" title="Edit Chat ID"
              class="w-6 h-6 rounded bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition">
              <i class="fa-solid fa-pen text-[10px]"></i>
            </button>
          </div>
        </td>
        <td class="p-3 text-[11px]">
          ${lastTestedDisplay}
        </td>
        <td class="p-3 text-right">
          <div class="flex items-center justify-end space-x-1.5">
            <button onclick="generateTelegramLinkCode(${r.userId})"
              class="px-2.5 py-1 text-[11px] rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 font-bold transition flex items-center gap-1">
              <i class="fa-solid fa-link text-[10px]"></i>
              <span>Link Account</span>
            </button>
            <button onclick="sendTelegramTest(${r.userId})" ${!isVerified ? 'disabled' : ''}
              class="px-2.5 py-1 text-[11px] rounded font-bold transition flex items-center gap-1 ${isVerified ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20' : 'bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed'}">
              <i class="fa-solid fa-paper-plane text-[10px]"></i>
              <span>Test</span>
            </button>
            ${isVerified || r.telegramChatId ? `
              <button onclick="unlinkTelegramAccount(${r.userId})" title="Unlink Telegram Account"
                class="px-2 py-1 text-[11px] rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold transition">
                <i class="fa-solid fa-link-slash text-[10px]"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderTelegramHistoryTable(history) {
  const tbody = document.getElementById('telegramHistoryTableBody');
  if (!tbody) return;

  if (!history || history.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-6 text-center text-gray-500 text-xs">
          No low-stock report transmission logs recorded yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = history.slice(0, 50).map(h => {
    const isSuccess = h.status === 'SUCCESS';
    const statusBadge = isSuccess
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">SUCCESS</span>`
      : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">FAILED</span>`;

    const typeBadge = h.deliveryType === 'TEST_MESSAGE'
      ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">TEST</span>`
      : `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">DAILY</span>`;

    const sentAtStr = h.sentAt ? new Date(h.sentAt).toLocaleString() : h.reportDate;

    return `
      <tr class="hover:bg-gray-900/40 transition">
        <td class="p-3 text-[11px] text-gray-300 font-mono">${escapeHtml(sentAtStr)}</td>
        <td class="p-3 text-xs font-bold text-white">${escapeHtml(h.managerName || 'Manager')}</td>
        <td class="p-3 text-[11px] font-mono text-gray-400">${escapeHtml(h.chatIdMasked || '—')}</td>
        <td class="p-3">${typeBadge}</td>
        <td class="p-3">${statusBadge}</td>
        <td class="p-3 text-xs font-semibold text-gray-300">${h.itemsCount || 0}</td>
        <td class="p-3 text-[11px] text-gray-400 truncate max-w-[200px]" title="${escapeHtml(h.errorDescription || 'Delivered successfully')}">
          ${escapeHtml(h.errorDescription || 'Delivered successfully')}
        </td>
      </tr>
    `;
  }).join('');
}

async function saveTelegramSettings() {
  const toggleEl = document.getElementById('telegramEnabledToggle');
  const sendTimeEl = document.getElementById('telegramSendTimeInput');

  const enabled = toggleEl ? toggleEl.checked : false;
  const dailySendTime = sendTimeEl ? sendTimeEl.value : '09:00';

  try {
    const updated = await apiRequest('/admin/telegram/settings', {
      method: 'PUT',
      body: JSON.stringify({
        enabled: enabled,
        dailySendTime: dailySendTime,
        timezone: 'Asia/Kolkata'
      })
    });

    telegramSettingsState = updated;
    showToast('Telegram settings saved successfully', 'success');
    loadTelegramData();
  } catch (err) {
    if (toggleEl && telegramSettingsState) {
      toggleEl.checked = telegramSettingsState.enabled; // Revert checkbox on error
    }
    showToast(err.message || 'Failed to save Telegram settings', 'error');
  }
}

async function toggleTelegramRecipient(userId, selected) {
  try {
    await apiRequest(`/admin/telegram/recipients/${userId}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ selected: selected })
    });
    showToast(`Recipient status updated`, 'success');
  } catch (err) {
    showToast('Failed to update recipient: ' + err.message, 'error');
    loadTelegramData();
  }
}

async function generateTelegramLinkCode(userId) {
  try {
    const data = await apiRequest(`/admin/telegram/recipients/${userId}/link-code`, {
      method: 'POST'
    });
    activeTelegramLinkData = data;

    const subtitleEl = document.getElementById('telegramLinkModalSubtitle');
    if (subtitleEl) subtitleEl.textContent = `Manager: ${data.managerName} (@${data.username})`;

    const codeEl = document.getElementById('telegramModalLinkCode');
    if (codeEl) codeEl.textContent = data.linkCode;

    const botTagEl = document.getElementById('telegramModalBotTag');
    if (botTagEl) botTagEl.textContent = data.botUsername ? `@${data.botUsername}` : 'your NERAM Bot';

    const cmdEl = document.getElementById('telegramModalCommandCode');
    if (cmdEl) cmdEl.textContent = `/link ${data.linkCode}`;

    const linkEl = document.getElementById('telegramModalDirectLink');
    if (linkEl) {
      linkEl.href = data.deepLink || (data.botUsername ? `https://t.me/${data.botUsername}?start=${data.linkCode}` : '#');
    }

    const modal = document.getElementById('telegramLinkModal');
    if (modal) modal.classList.remove('hidden');
  } catch (err) {
    showToast('Failed to generate link code: ' + err.message, 'error');
  }
}

function closeTelegramLinkModal() {
  const modal = document.getElementById('telegramLinkModal');
  if (modal) modal.classList.add('hidden');
  loadTelegramData();
}

function copyTelegramLinkInstructions() {
  if (!activeTelegramLinkData) return;
  const botTag = activeTelegramLinkData.botUsername ? `@${activeTelegramLinkData.botUsername}` : 'the bot';
  const text = `NERAM POS Telegram Verification:\n1. Open Telegram and search for ${botTag}\n2. Send command: /link ${activeTelegramLinkData.linkCode}\n(Code valid for 15 minutes)`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Linking instructions copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Link code: ' + activeTelegramLinkData.linkCode, 'info');
  });
}

function openTelegramChatIdModal(userId, managerName, currentChatId) {
  const idEl = document.getElementById('telegramChatIdModalUserId');
  if (idEl) idEl.value = userId;

  const nameEl = document.getElementById('telegramChatIdModalManagerName');
  if (nameEl) nameEl.textContent = managerName;

  const inputEl = document.getElementById('telegramChatIdInput');
  if (inputEl) inputEl.value = currentChatId || '';

  const modal = document.getElementById('telegramChatIdModal');
  if (modal) modal.classList.remove('hidden');
}

function closeTelegramChatIdModal() {
  const modal = document.getElementById('telegramChatIdModal');
  if (modal) modal.classList.add('hidden');
}

async function submitTelegramChatIdUpdate() {
  const idEl = document.getElementById('telegramChatIdModalUserId');
  const inputEl = document.getElementById('telegramChatIdInput');
  const userId = idEl ? idEl.value : null;
  const chatId = inputEl ? inputEl.value.trim() : '';

  if (!userId || !chatId) {
    showToast('Please enter a valid Telegram Chat ID', 'error');
    return;
  }

  try {
    await apiRequest(`/admin/telegram/recipients/${userId}/chat-id`, {
      method: 'PUT',
      body: JSON.stringify({ chatId: chatId })
    });
    showToast('Telegram Chat ID saved successfully', 'success');
    closeTelegramChatIdModal();
    loadTelegramData();
  } catch (err) {
    showToast('Failed to update Chat ID: ' + err.message, 'error');
  }
}

async function unlinkTelegramAccount(userId) {
  if (!confirm('Unlink this manager\'s Telegram account? They will no longer receive daily low-stock reports until linked again.')) {
    return;
  }

  try {
    await apiRequest(`/admin/telegram/recipients/${userId}/unlink`, {
      method: 'DELETE'
    });
    showToast('Telegram account unlinked successfully', 'success');
    loadTelegramData();
  } catch (err) {
    showToast('Failed to unlink account: ' + err.message, 'error');
  }
}

async function sendTelegramTest(userId) {
  showToast('Sending test message via Telegram...', 'info');
  try {
    const res = await apiRequest(`/admin/telegram/recipients/${userId}/test`, {
      method: 'POST'
    });
    showToast(res.message || 'Test message delivered successfully!', 'success');
    loadTelegramData();
  } catch (err) {
    showToast('Test delivery failed: ' + err.message, 'error');
  }
}

async function openTelegramPreviewModal() {
  try {
    const preview = await apiRequest('/admin/telegram/preview');
    telegramPreviewState = preview;

    const botSenderEl = document.getElementById('previewBotSender');
    if (botSenderEl) {
      botSenderEl.textContent = telegramSettingsState && telegramSettingsState.botUsername
        ? `@${telegramSettingsState.botUsername}` : 'NERAM POS Bot';
    }

    const timeEl = document.getElementById('previewMessageTime');
    if (timeEl) {
      timeEl.textContent = (telegramSettingsState && telegramSettingsState.dailySendTime)
        ? telegramSettingsState.dailySendTime + ' IST' : '09:00 AM';
    }

    const contentEl = document.getElementById('telegramPreviewReportContent');
    if (contentEl) {
      // Strip HTML tags for clean simulation or render formatted HTML
      contentEl.innerHTML = preview.formattedReport || 'No report available';
    }

    const badgeEl = document.getElementById('previewItemCountBadge');
    if (badgeEl) {
      badgeEl.textContent = `${preview.itemCount} low-stock item(s)`;
    }

    const modal = document.getElementById('telegramPreviewModal');
    if (modal) modal.classList.remove('hidden');
  } catch (err) {
    showToast('Failed to load report preview: ' + err.message, 'error');
  }
}

function closeTelegramPreviewModal() {
  const modal = document.getElementById('telegramPreviewModal');
  if (modal) modal.classList.add('hidden');
}

async function triggerTelegramDailySendNow() {
  if (!confirm('Send today\'s low-stock summary immediately to all verified active managers?')) {
    return;
  }

  showToast('Dispatching Telegram low-stock report...', 'info');
  try {
    const res = await apiRequest('/admin/telegram/send-now', {
      method: 'POST'
    });
    showToast(`Dispatch complete: Sent to ${res.sentCount} manager(s), ${res.failedCount} failed`, res.failedCount > 0 ? 'warning' : 'success');
    loadTelegramData();
  } catch (err) {
    showToast('Failed to execute daily dispatch: ' + err.message, 'error');
  }
}

async function loadTelegramHistory() {
  try {
    const history = await apiRequest('/admin/telegram/history');
    renderTelegramHistoryTable(history);
    showToast('Delivery history refreshed', 'success');
  } catch (err) {
    showToast('Failed to load delivery history: ' + err.message, 'error');
  }
}
