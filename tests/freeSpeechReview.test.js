import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_REVIEW_MODEL, MAX_REVIEWS_PER_DAY, validateReviewRequest,
  makeEvidenceChunks, buildReviewPrompt, parseGroundedReview,
  ensureFreePreview, reserveReviewQuota, classifyReviewProviderError,
} from '../server/freeSpeechReview.js';

const input = {
  consent: true, sessionId: 'ses_1234567',
  topic: 'Bảo vệ dữ liệu cá nhân', topicDescription: 'Thực hành an toàn số',
  speakingGoal: 'Giải thích lập luận và đề xuất giải pháp',
  transcript: 'Hôm nay em trình bày về việc bảo vệ dữ liệu cá nhân. ' +
    'Trước tiên cần đặt mật khẩu mạnh và bật xác thực nhiều bước. ' +
    'Tiếp theo chúng ta tránh cung cấp mật khẩu cho người lạ.',
  slides: [],
};

test('unpaid Preview is required before any provider call', () => {
  assert.equal(FREE_REVIEW_MODEL, 'gemini-3.5-flash-lite');
  assert.equal(MAX_REVIEWS_PER_DAY, 5);
  assert.throws(() => ensureFreePreview({ VERCEL_ENV: 'production', GEMINI_API_KEY: 'key', SPEAKLAB_GEMINI_FREE_TIER_CONFIRMED: 'true' }));
  assert.throws(() => ensureFreePreview({ VERCEL_ENV: 'preview', GEMINI_API_KEY: 'key' }));
  assert.throws(() => ensureFreePreview({ VERCEL_ENV: 'preview', SPEAKLAB_GEMINI_FREE_TIER_CONFIRMED: 'true' }));
  assert.doesNotThrow(() => ensureFreePreview({ VERCEL_ENV: 'preview', GEMINI_API_KEY: 'key', SPEAKLAB_GEMINI_FREE_TIER_CONFIRMED: 'true' }));
});

test('review request requires explicit consent and a real transcript; pptx optional', () => {
  const valid = validateReviewRequest(input);
  assert.deepEqual(valid.slides, []);
  assert.equal(valid.transcript, input.transcript);
  assert.throws(() => validateReviewRequest({ ...input, consent: false }));
  assert.throws(() => validateReviewRequest({ ...input, transcript: '' }));
  assert.throws(() => validateReviewRequest({ ...input, transcript: 'a'.repeat(24001) }));
  assert.throws(() => validateReviewRequest({ ...input, topic: 'x'.repeat(121) }));
  assert.throws(() => validateReviewRequest({ ...input, slides: [{ number: 1, text: 'A' }, { number: 1, text: 'B' }] }));
  assert.deepEqual(validateReviewRequest({ ...input, slides: [{ number: 1, text: 'Ví dụ trực quan' }] }).slides,
    [{ number: 1, text: 'Ví dụ trực quan' }]);
});

test('grounded review uses real evidence IDs and rejects invented slide/source', () => {
  const chunks = makeEvidenceChunks(input.transcript, 65);
  assert.ok(chunks.length >= 2);
  const prompt = buildReviewPrompt(input, chunks);
  assert.ok(prompt.includes('E1'));
  assert.match(prompt, /KHÔNG có âm thanh/u);
  assert.match(prompt, /NGHIÊM CẤM nhận xét hoặc suy đoán về phát âm/u);
  assert.match(prompt, /lỗi có thể do ASR nhận diện/u);

  const makePayload = () => ({
    summary: 'Bài nói đã giới thiệu việc bảo vệ dữ liệu và đề xuất biện pháp cơ bản.',
    strengths: [
      { point: 'Bài nói nêu đề tài ngay từ phần mở đầu.', evidenceId: 'E1' },
      { point: 'Có giải pháp bảo mật tài khoản thực tế.', evidenceId: 'E2' },
    ],
    improvements: [
      { point: 'Cần giải thích cơ sở lựa chọn giải pháp.', evidenceId: 'E2', action: 'Thêm ví dụ về nguy cơ lộ mật khẩu.' },
      { point: 'Nên thêm kết luận và liên hệ thực tiễn.', evidenceId: 'E1', action: 'Tóm tắt ba ý chính cuối bài.' },
    ],
    slideComparisons: [],
    limitations: ['Không đánh giá giọng nói từ văn bản nhận diện.'],
  });
  const good = parseGroundedReview(JSON.stringify(makePayload()), chunks, []);
  assert.equal(good.source, 'transcript');
  assert.ok(good.strengths[0].evidence.includes('Hôm nay'));
  assert.equal(good.slideComparisons.length, 0);
  assert.match(good.limitations[0], /giọng nói/u);

  const unsupportedDelivery = makePayload();
  unsupportedDelivery.improvements[0].point = 'Phát âm từ AI trong lời nói đôi khi chưa chuẩn xác.';
  assert.throws(
    () => parseGroundedReview(JSON.stringify(unsupportedDelivery), chunks, []),
    /vượt quá dữ liệu văn bản/u,
    'Không được hiển thị nhận xét phát âm khi chỉ có bản ghi TXT.',
  );

  assert.throws(() => parseGroundedReview(JSON.stringify({
    ...makePayload(), strengths: [
      { point: 'Nhận xét không có chứng cứ.', evidenceId: 'E999' }, makePayload().strengths[1],
    ],
  }), chunks, []));
  assert.throws(() => parseGroundedReview(JSON.stringify({
    ...makePayload(), slideComparisons: [{ slideNumber: 1, point: 'Slide có nội dung.', evidenceId: 'E1' }],
  }), chunks, []));
  const withSlides = parseGroundedReview(JSON.stringify({
    ...makePayload(), slideComparisons: [{ slideNumber: 1, point: 'Slide minh họa đúng phần bảo mật.', evidenceId: 'E2' }],
  }), chunks, [{ number: 1, text: 'Mật khẩu mạnh' }]);
  assert.equal(withSlides.source, 'transcript_and_pptx');
});

test('review quota is fail-closed and shared across instances', async () => {
  await assert.rejects(() => reserveReviewQuota('12345', {}), e => e.status === 503);
  let count = 0;
  const env = {
    SPEAKLAB_RATE_LIMIT_REST_URL: 'https://test-redis.example.com',
    SPEAKLAB_RATE_LIMIT_REST_TOKEN: 'secret',
  };
  const mocked = async (url, opts) => {
    assert.equal(url, 'https://test-redis.example.com/multi-exec');
    assert.equal(JSON.parse(opts.body)[0][0], 'INCR');
    count++;
    return { ok: true, json: async () => [{ result: count }, { result: 1 }] };
  };
  for (let i = 0; i < 5; i++) assert.equal(await reserveReviewQuota('12345', env, mocked), 4 - i);
  await assert.rejects(() => reserveReviewQuota('12345', env, mocked), e => e.status === 429);
  await assert.rejects(() => reserveReviewQuota('12345', env, async () => ({ ok: false })), e => e.status === 503);
});


test('classifies provider errors safely without leaking raw provider messages', () => {
  const cases = [
    [429, 'GEMINI_FREE_QUOTA', 429],
    [403, 'GEMINI_ACCESS_DENIED', 503],
    [401, 'GEMINI_ACCESS_DENIED', 503],
    [404, 'GEMINI_MODEL_UNAVAILABLE', 503],
    [503, 'GEMINI_TEMPORARILY_UNAVAILABLE', 503],
    [400, 'GEMINI_REQUEST_REJECTED', 502],
    [502, 'GEMINI_UNKNOWN_ERROR', 502],
  ];
  for (const [status, code, publicStatus] of cases) {
    const result = classifyReviewProviderError({
      status, message: 'PRIVATE_SECRET_FROM_PROVIDER',
    });
    assert.equal(result.status, publicStatus);
    assert.equal(result.code, code);
    assert.equal(JSON.stringify(result).includes('PRIVATE_SECRET_FROM_PROVIDER'), false);
  }
  const modelError = classifyReviewProviderError({ message: 'models/gemini-2.5-flash-lite is not found' });
  assert.equal(modelError.code, 'GEMINI_MODEL_UNAVAILABLE');
});
