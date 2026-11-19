import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFENSE_ROLES, buildDefenseQuestionsPrompt, parseDefenseQuestions,
  signDefenseChallenge, verifyDefenseChallenge, validateDefenseAnswers,
  buildDefenseFeedbackPrompt, parseDefenseFeedback,
} from '../server/aiDefense.js';

const secret = 'a_very_long_test_only_secret_for_hmac_0123456789';
const evidence = [
  { id: 'E1', text: 'Em nghiên cứu phương pháp cảnh báo sạt lở đất bằng camera AI và cảm biến IoT ở vùng núi.' },
  { id: 'E2', text: 'Mục tiêu là phát hiện sớm nguy cơ và hỗ trợ người dân kịp thời di chuyển.' },
];
const slides = [{ number: 1, text: 'Giới thiệu hệ thống cảnh báo sạt lở đất bằng AI và IoT' }];
const input = {
  sessionId: 'ses_1234567890',
  topic: 'Hệ thống cảnh báo sạt lở đất bằng AI và IoT',
  topicDescription: '',
  speakingGoal: 'Bảo vệ giải pháp kỹ thuật',
  transcript: evidence.map(x => x.text).join(' '),
  slides,
};
const rawQuestions = {
  questions: [
    { question: 'Vì sao em lựa chọn vấn đề cảnh báo sạt lở đất thay vì các loại thiên tai khác?', evidenceId: 'E1', slideNumber: 1 },
    { question: 'Em sẽ kiểm thử khả năng phát hiện nguy cơ của camera AI và cảm biến IoT như thế nào?', evidenceId: 'E1', slideNumber: 0 },
    { question: 'Nếu camera bị che khuất bởi mưa lớn, em dự kiến xử lý việc cảnh báo ra sao?', evidenceId: 'E2', slideNumber: 0 },
  ],
};
const questions = parseDefenseQuestions(JSON.stringify(rawQuestions), evidence, slides);
const answers = [
  { id: 'J1', text: 'Em chọn vấn đề này vì sạt lở đất có thể gây nguy hiểm cho các khu dân cư miền núi.' },
  { id: 'J2', text: 'Em dự kiến thử trên mô hình nhỏ và cần so sánh kết quả với quan sát thực tế.' },
  { id: 'J3', text: '' },
];
const feedback = {
  feedback: [
    { id: 'J1', answerQuote: 'sạt lở đất có thể gây nguy hiểm',
      covered: 'Đã nêu được lý do xuất phát từ nguy cơ đối với khu dân cư.',
      missing: 'Chưa đưa ra ví dụ hoặc dẫn chứng cụ thể về nhu cầu cảnh báo.',
      nextStep: 'Bổ sung một số liệu thực tế có nguồn rõ ràng nếu đã thu thập được.' },
    { id: 'J2', answerQuote: 'thử trên mô hình nhỏ',
      covered: 'Đã nêu dự định kiểm thử mô hình để kiểm tra giải pháp.',
      missing: 'Chưa nêu tiêu chí đo lường và cách xác định kết quả đạt yêu cầu.',
      nextStep: 'Nêu cách chia trường hợp thử và bảng ghi lại các lần phát hiện.' },
    { id: 'J3', answerQuote: '',
      covered: 'Chưa có câu trả lời để xác định nội dung học sinh đã giải đáp.',
      missing: 'Cần làm rõ phương án dự phòng khi camera bị ảnh hưởng bởi thời tiết.',
      nextStep: 'Bắt đầu bằng cách nêu giới hạn cảm biến rồi đề xuất phương án thay thế.' },
  ],
};

test('grounded council creates exactly three distinct roles with valid source IDs', () => {
  assert.deepEqual(questions.map(x => x.id), DEFENSE_ROLES.map(x => x.id));
  assert.equal(questions[0].evidenceId, 'E1');
  assert.equal(questions[0].slideNumber, 1);
  assert.match(buildDefenseQuestionsPrompt(input, evidence), /không tự giả định/iu);
  assert.throws(() => parseDefenseQuestions(JSON.stringify({
    questions: rawQuestions.questions.slice(0, 2),
  }), evidence, slides), /ba câu hỏi/u);
  assert.throws(() => parseDefenseQuestions(JSON.stringify({
    questions: [{ ...rawQuestions.questions[0], evidenceId: 'E999' }, ...rawQuestions.questions.slice(1)],
  }), evidence, slides), /chưa đủ căn cứ/u);
  assert.throws(() => parseDefenseQuestions(JSON.stringify({
    questions: [{ ...rawQuestions.questions[0], slideNumber: 999 }, ...rawQuestions.questions.slice(1)],
  }), evidence, slides), /chưa đủ căn cứ/u);
  assert.throws(() => parseDefenseQuestions(JSON.stringify({
    questions: [rawQuestions.questions[0], rawQuestions.questions[0], rawQuestions.questions[2]],
  }), evidence, slides), /bị lặp/u);
});

test('signed challenge binds user, session, transcript, slides and 24-hour lifetime', () => {
  const now = Date.UTC(2026, 10, 19, 9, 0, 0);
  const token = signDefenseChallenge(questions, input, '123456789', secret, now);
  assert.deepEqual(verifyDefenseChallenge(token, input, '123456789', secret, now + 3600e3), questions);
  assert.throws(() => verifyDefenseChallenge(token, input, 'other_user', secret, now + 3600e3));
  assert.throws(() => verifyDefenseChallenge(token, { ...input, transcript: input.transcript + ' chỉnh sửa' }, '123456789', secret, now + 3600e3));
  assert.throws(() => verifyDefenseChallenge(token, { ...input, slides: [] }, '123456789', secret, now + 3600e3));
  assert.throws(() => verifyDefenseChallenge(token, input, '123456789', secret, now + 86400e3));
  assert.throws(() => verifyDefenseChallenge(token.slice(0, -3) + 'abc', input, '123456789', secret, now));
  assert.throws(() => signDefenseChallenge(questions, input, '123456789', 'short'));
});

test('answer checks require correct role sequence and allow explicit skipped answers', () => {
  assert.deepEqual(validateDefenseAnswers(answers), answers);
  assert.throws(() => validateDefenseAnswers([{ ...answers[0], id: 'J3' }, ...answers.slice(1)]));
  assert.throws(() => validateDefenseAnswers(answers.map(x => ({ ...x, text: '' }))));
  assert.throws(() => validateDefenseAnswers([{ ...answers[0], text: 'quá ngắn' }, ...answers.slice(1)]));
  assert.throws(() => validateDefenseAnswers([{ ...answers[0], text: 'a'.repeat(2501) }, ...answers.slice(1)]));
});

test('feedback is anchored to verbatim answer text and blocks fabricated evidence and scores', () => {
  const parsed = parseDefenseFeedback(JSON.stringify(feedback), questions, answers);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[2].answerQuote, '');
  assert.match(buildDefenseFeedbackPrompt(input, questions, answers, evidence), /không chấm điểm/u);
  const tamper = rows => JSON.stringify({ feedback: rows });
  assert.throws(() => parseDefenseFeedback(tamper([
    { ...feedback.feedback[0], answerQuote: 'nội dung không được học sinh trả lời' }, ...feedback.feedback.slice(1),
  ]), questions, answers), /trích dẫn/u);
  assert.throws(() => parseDefenseFeedback(tamper([
    { ...feedback.feedback[0], covered: 'Em đã đạt 9/10 điểm.' }, ...feedback.feedback.slice(1),
  ]), questions, answers), /đánh giá ngoài phạm vi/u);
  assert.throws(() => parseDefenseFeedback(tamper([
    { ...feedback.feedback[0], covered: 'Giọng điệu rất tốt khi trình bày ý tưởng.' }, ...feedback.feedback.slice(1),
  ]), questions, answers), /đánh giá ngoài phạm vi/u);
  assert.throws(() => parseDefenseFeedback(tamper([
    ...feedback.feedback.slice(0, 2),
    { ...feedback.feedback[2], answerQuote: 'tự bịa' },
  ]), questions, answers), /trích dẫn/u);
  assert.throws(() => parseDefenseFeedback(JSON.stringify({ feedback: feedback.feedback.slice(0, 2) }), questions, answers));
});
