const API_URL = '/api';
const REQUEST_TIMEOUT = 10000;

function showState(stateId) {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('success-state').classList.add('hidden');
  document.getElementById('error-state').classList.add('hidden');
  const target = document.getElementById(stateId);
  if (target) target.classList.remove('hidden');
}

function showError(msg) {
  showState('error-state');
  const errorEl = document.getElementById('error-message');
  if (errorEl) errorEl.textContent = msg;
}

async function verifyEmail(token) {
  let timeoutId;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(`${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errMsg = `Yêu cầu thất bại (${response.status})`;
      try {
        const errData = await response.json();
        errMsg = errData.message || errMsg;
      } catch { /* ignore parse error */ }
      showError(errMsg);
      return;
    }

    const data = await response.json();

    if (data.success) {
      showState('success-state');
    } else {
      const msg = data.message || 'Token không hợp lệ hoặc đã hết hạn.';
      if (msg.includes('đã được xác minh') && msg.includes('trước đó')) {
        showState('success-state');
        document.querySelector('#success-state h1').textContent = 'Email đã được xác minh!';
        document.querySelector('#success-state p').innerHTML =
          'Tài khoản của bạn đã được xác minh trước đó.<br>Bạn có thể đăng nhập ngay.';
      } else if (msg.includes('gửi lại') || msg.includes('mới nhất') || msg.includes('Token không hợp lệ')) {
        showError('Token không hợp lệ. Vui lòng yêu cầu gửi lại email xác minh mới.');
      } else {
        showError(msg);
      }
    }
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    console.error('Verification error:', error);
    if (error.name === 'AbortError') {
      showError('Yêu cầu hết thời gian. Vui lòng kiểm tra kết nối và thử lại.');
    } else {
      showError('Không thể kết nối đến server. Vui lòng thử lại sau.');
    }
  }
}

// Extract token from URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

if (token) {
  verifyEmail(token);
} else {
  showError('Không tìm thấy token xác minh trong URL.');
}
