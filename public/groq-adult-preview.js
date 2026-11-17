/* Isolated operator UI: no localStorage, no uploads, no automatic retries. */
const $ = id => document.getElementById(id);
const status = $('status');
const confirm = $('confirmation');
const send = $('send');
const result = $('result');
const review = $('review');
let ready = false;
let locked = false;
let snapshot = null;

const add = (root, tag, value) => {
  const el = document.createElement(tag);
  el.textContent = String(value ?? '');
  root.appendChild(el);
  return el;
};
function draft() {
  const slides = [1, 2, 3].map(n => ({ number: n, text: $('slide' + n).value.trim() }))
    .filter(slide => slide.text);
  return {
    sessionId: 'ses_adult_preview01',
    topic: $('topic').value.trim(),
    speakingGoal: $('goal').value.trim(),
    transcript: $('transcript').value.trim(),
    slides,
  };
}
function reset() {
  confirm.hidden = true;
  send.disabled = true;
  snapshot = null;
  for (const id of ['adult', 'transfer', 'onecall']) $(id).checked = false;
}
for (const id of ['topic', 'goal', 'transcript', 'slide1', 'slide2', 'slide3']) {
  $(id).addEventListener('input', reset);
}
for (const id of ['adult', 'transfer', 'onecall']) {
  $(id).addEventListener('change', () => {
    send.disabled = !ready || locked || !snapshot ||
      !($('adult').checked && $('transfer').checked && $('onecall').checked);
  });
}
$('preview').addEventListener('click', () => {
  reset();
  const data = draft();
  if (!data.topic || data.transcript.length < 20 || data.transcript.length > 3500) {
    status.textContent = 'Hãy nhập đề tài và bản ghi từ 20 đến 3.500 ký tự.';
    return;
  }
  snapshot = JSON.stringify(data);
  $('preview-content').textContent = JSON.stringify({
    ...data,
    destination: 'Groq API – openai/gpt-oss-20b',
    note: 'Chỉ xem trước phần dữ liệu đầu vào. Máy chủ thêm chỉ dẫn kiểm chứng và chia đoạn dẫn chứng.',
  }, null, 2);
  confirm.hidden = false;
  confirm.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
async function check() {
  try {
    const response = await fetch('/api/groq/adult-preview', { credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      status.textContent = data.error || 'Chưa có quyền truy cập khu vực này.';
      return;
    }
    ready = data.ready === true;
    status.textContent = ready
      ? 'Đã sẵn sàng. Chỉ dùng nội dung do người lớn tự viết và không có dữ liệu cá nhân.'
      : 'Trang nhập và xem trước đã sẵn sàng, nhưng gửi tới Groq đang bị khóa trên máy chủ. Cần hoàn tất điều kiện bảo vệ dữ liệu và quản trị viên bật riêng cho Preview.';
  } catch {
    status.textContent = 'Không thể kết nối đến máy chủ Preview để kiểm tra quyền.';
  }
}
send.addEventListener('click', async () => {
  if (!ready || locked || !snapshot || !($('adult').checked && $('transfer').checked && $('onecall').checked)) return;
  locked = true;
  send.disabled = true;
  $('preview').disabled = true;
  const payload = JSON.parse(snapshot);
  status.textContent = 'Đã khóa lần gửi này. Hệ thống chỉ gửi một yêu cầu tới Groq.';
  result.hidden = true;
  review.replaceChildren();
  try {
    const response = await fetch('/api/groq/adult-preview', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        adultSelfAuthored: true, confirmExternalTransfer: true, confirmOneCall: true,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      status.textContent = (data.error || 'Yêu cầu không thành công.') +
        ' Không tự động gửi lại, tránh tiêu tốn thêm quota.';
      return;
    }
    status.textContent = 'Đã trả kết quả qua Groq Preview, không lưu vào Lịch sử SpeakLab.';
    result.hidden = false;
    add(review, 'h3', 'Tổng quan');
    add(review, 'p', data.review.summary);
    for (const [title, key] of [['Điểm mạnh','strengths'], ['Cần cải thiện','improvements']]) {
      add(review, 'h3', title);
      for (const item of data.review[key] || []) {
        const article = add(review, 'article', '');
        add(article, 'p', item.point);
        add(article, 'blockquote', item.evidence);
        if (item.action) add(article, 'p', 'Gợi ý: ' + item.action);
      }
    }
    add(review, 'h3', 'Đối chiếu chữ slide và bản ghi');
    for (const item of data.review.slideComparisons || []) {
      const article = add(review, 'article', '');
      add(article, 'h4', 'Slide ' + item.slideNumber + ' · ' + item.status);
      add(article, 'p', item.point);
      add(article, 'p', 'Slide: ' + item.slideQuote);
      add(article, 'p', 'Bài nói: ' + (item.spokenQuote || 'Chưa có dẫn chứng xác minh'));
      add(article, 'p', 'Cần kiểm tra: ' + item.missing);
      add(article, 'p', 'Gợi ý: ' + item.action);
    }
    add(review, 'h3', 'Giới hạn');
    for (const line of data.review.limitations || []) add(review, 'p', line);
    add(review, 'p', data.note);
  } catch {
    status.textContent = 'Kết nối bị gián đoạn. Để tránh tiêu thụ trùng quota, không tự gửi lại.';
  }
});
void check();
