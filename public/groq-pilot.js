/* This static UI sends no student content and renders responses as plain text. */
const status = document.getElementById('status');
const button = document.getElementById('run');
const result = document.getElementById('result');
const reviewRoot = document.getElementById('review');
const changeStatus = (message) => { status.textContent = message; };
const line = (parent, tag, text) => {
  const el = document.createElement(tag);
  el.textContent = String(text || 'Không có dữ liệu');
  parent.appendChild(el);
  return el;
};

async function checkReady() {
  try {
    const response = await fetch('/api/groq/pilot', { credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ready) {
      changeStatus(data.error || 'Không thể xác minh quyền chạy thử trên bản Preview này.');
      return;
    }
    changeStatus('Sẵn sàng. Đã xác nhận tài khoản vận hành và có khóa Groq trên máy chủ Preview.');
    button.disabled = false;
  } catch {
    changeStatus('Không thể liên lạc API thử nghiệm trên Vercel Preview.');
  }
}

button.addEventListener('click', async () => {
  button.disabled = true;
  result.hidden = true;
  reviewRoot.replaceChildren();
  changeStatus('Đang gửi một yêu cầu dùng dữ liệu giả lập tới Groq…');
  try {
    const response = await fetch('/api/groq/pilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ syntheticOnly: true, confirmOneCall: true }),
    });
    const data = await response.json();
    if (!response.ok) {
      changeStatus(data.error || 'Thử nghiệm chưa thành công.');
      return;
    }
    changeStatus('Đã nhận kết quả Groq qua Vercel Preview. Không có dữ liệu học sinh được gửi.');
    result.hidden = false;
    line(reviewRoot, 'p', data.review?.summary);
    for (const c of data.review?.criteria || []) {
      const article = document.createElement('article');
      line(article, 'h3', c.criterion);
      line(article, 'p', c.comment);
      const quote = line(article, 'blockquote', c.quote);
      quote.setAttribute('aria-label', 'Dẫn chứng nguyên văn');
      line(article, 'p', 'Gợi ý: ' + c.suggestion);
      reviewRoot.appendChild(article);
    }
    line(reviewRoot, 'p', 'Giới hạn đánh giá: ' + (data.review?.limitations || 'Không rõ'));
    line(reviewRoot, 'p', data.note || 'Dữ liệu giả lập.');
  } catch {
    changeStatus('Lỗi kết nối đến API thử nghiệm. Không tự động gửi lại.');
  }
});

void checkReady();
