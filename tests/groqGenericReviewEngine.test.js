import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runGenericGroqReview, GROQ_GENERIC_REVIEW_SCHEMA, buildCompactGroqReviewPrompt } from '../server/groqGenericReviewEngine.js';

const input = {
  consent: true, sessionId: 'ses_adult_12345',
  topic: 'Đánh giá phương án di chuyển bền vững',
  topicDescription: 'Một bài phát biểu tự viết cho người trưởng thành',
  speakingGoal: 'So sánh hai biện pháp và giải thích giới hạn',
  transcript: 'Hôm nay tôi trình bày về việc giảm khí thải khi đi lại. ' +
    'Phương án thứ nhất là đi xe đạp ở quãng đường ngắn, có thể tiết kiệm nhiên liệu. ' +
    'Phương án thứ hai là đi xe buýt khi có tuyến phù hợp, từ đó giảm số chuyến xe cá nhân. ' +
    'Tuy nhiên tôi chưa thu thập số liệu để so sánh mức giảm phát thải giữa hai cách. ' +
    'Xin cảm ơn mọi người đã lắng nghe.',
  slides: [
    { number: 1, text: 'Đi xe đạp trên quãng đường ngắn' },
    { number: 2, text: 'Đi xe buýt khi có tuyến phù hợp' },
  ],
};
const bad = (response) => ({
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(response) } }],
});
const mockResponse = (slides = input.slides) => ({
  summary: 'Bài thuyết trình nêu hai giải pháp giảm khí thải, đồng thời thừa nhận thiếu số liệu so sánh.',
  strengths: [
    { point: 'Bài nói xác định rõ chủ đề giảm khí thải trong phần mở đầu.', evidenceId: 'E1' },
    { point: 'Bài trình bày hai phương án di chuyển dễ hình dung trong thực tế.', evidenceId: 'E1' },
  ],
  improvements: [
    { point: 'Bản ghi chưa có số liệu để so sánh hiệu quả phát thải.', evidenceId: 'E1',
      action: 'Thêm số liệu khảo sát hoặc nêu rõ cách thu thập để kiểm tra từng phương án.' },
    { point: 'Phần kết chưa nhắc lại điều kiện áp dụng của từng phương án.', evidenceId: 'E1',
      action: 'Tóm tắt trường hợp nên đi xe đạp và khi nào có thể chọn xe buýt.' },
  ],
  slideComparisons: slides.map(slide => ({
    slideNumber: slide.number, status: 'possible_difference',
    point: 'Nội dung riêng trên slide số ' + slide.number + ' cần đối chiếu với phần bản ghi lời nói.',
    slideQuote: slide.text, spokenQuote: 'Hôm nay tôi trình bày về việc giảm khí thải khi đi lại.',
    evidenceId: 'E1',
    covered: 'Bản ghi đề cập các biện pháp giảm khí thải, cần xem thêm ngữ cảnh slide số ' + slide.number + '.',
    missing: 'Chưa có đồng bộ thời điểm nói với slide số ' + slide.number + ' đang được trình chiếu.',
    action: 'Đối chiếu riêng nội dung và giải thích ở slide số ' + slide.number + ' với bản ghi ASR.',
  })),
  limitations: ['Không có dữ liệu đo đạc thực tế để xác nhận lợi ích môi trường.'],
});
function mockedFetcher(fn) {
  let calls = 0;
  return {
    get calls() { return calls; },
    fetch: async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      assert.match(options.headers.Authorization, /^Bearer TEST_KEY/u);
      const payload = JSON.parse(options.body);
      assert.ok(payload.messages[1].content.includes(input.transcript));
      assert.equal(payload.response_format.type, 'json_schema');
      const data = fn();
      return { ok: true, json: async () => bad(data) };
    },
  };
}

test('generic engine: validates non-fixed adult-authored transcript with exactly one mocked provider request', async () => {
  const spy = mockedFetcher(() => mockResponse());
  const response = await runGenericGroqReview({ input, apiKey: 'TEST_KEY', fetcher: spy.fetch });
  assert.equal(spy.calls, 1);
  assert.equal(response.model, 'openai/gpt-oss-20b');
  assert.equal(response.review.model, 'openai/gpt-oss-20b');
  assert.equal(response.review.strengths.length, 2);
  assert.equal(response.review.improvements.length, 2);
  assert.equal(response.review.slideComparisons.length, 2);
  assert.equal(response.review.slideReviewStats.accepted, 2);
  assert.equal(response.review.slideOverview.length, 2);
  assert.equal(response.review.slideComparisons[1].slideQuote, input.slides[1].text);
  assert.equal(GROQ_GENERIC_REVIEW_SCHEMA.properties.slideComparisons.items.properties.slideNumber.type, 'integer');
});

test('generic engine: works without slide content, still validates 2 strengths and 2 improvements', async () => {
  const spy = mockedFetcher(() => mockResponse([]));
  const result = await runGenericGroqReview({
    input: { ...input, slides: [] }, apiKey: 'TEST_KEY', fetcher: spy.fetch,
  });
  assert.equal(spy.calls, 1);
  assert.equal(result.review.slideComparisons.length, 0);
  assert.equal(result.review.source, 'transcript');
});

test('generic engine: validates all 18 and 40 distinct slides, never just the first three', async () => {
  for (const count of [18, 40]) {
    const slides = Array.from({ length: count }, (_, i) => ({
      number: i + 1, text: 'Biện pháp đi lại bền vững và phù hợp với nơi ở – nội dung ' + (i + 1),
    }));
    const spy = mockedFetcher(() => mockResponse(slides));
    const result = await runGenericGroqReview({
      input: { ...input, slides }, apiKey: 'TEST_KEY', fetcher: spy.fetch,
    });
    assert.equal(spy.calls, 1, 'Only one call for ' + count + ' slides');
    assert.equal(result.review.slideReviewStats.target, count);
    assert.equal(result.review.slideReviewStats.accepted, count);
    assert.equal(result.review.slideComparisons.length, count);
    assert.equal(result.review.slideComparisons.at(-1).slideNumber, count);
    assert.equal(result.review.slideComparisons.at(-1).slideQuote, slides.at(-1).text);
  }
});

test('quality gate: missing late slide in 40-slide report is rejected before display', async () => {
  const slides = Array.from({ length: 40 }, (_, i) => ({
    number: i + 1, text: 'Nội dung về giao thông và môi trường số ' + (i + 1),
  }));
  const spy = mockedFetcher(() => mockResponse(slides.slice(0, 39)));
  await assert.rejects(runGenericGroqReview({
    input: { ...input, slides }, apiKey: 'TEST_KEY', fetcher: spy.fetch,
  }), { code: 'GROQ_QUALITY_SLIDE_COVERAGE' });
  assert.equal(spy.calls, 1);
});

test('quality gate: repeated generic slide feedback cannot replace Gemini', async () => {
  const slides = Array.from({ length: 18 }, (_, i) => ({
    number: i + 1, text: 'Biện pháp di chuyển bền vững số ' + (i + 1),
  }));
  const spy = mockedFetcher(() => {
    const response = mockResponse(slides);
    response.slideComparisons = response.slideComparisons.map(item => ({
      ...item, point: 'Nội dung trình bày có thể cải thiện thêm bằng cách bổ sung giải thích.',
      covered: 'Bản ghi có đề cập chung đến chủ đề bài thuyết trình.',
      missing: 'Nội dung cần có thêm ví dụ và dẫn chứng để làm rõ.',
      action: 'Bổ sung dẫn chứng và ví dụ cụ thể hơn cho bài trình bày.',
    }));
    return response;
  });
  await assert.rejects(runGenericGroqReview({
    input: { ...input, slides }, apiKey: 'TEST_KEY', fetcher: spy.fetch,
  }), { code: 'GROQ_QUALITY_REPETITION' });
  assert.equal(spy.calls, 1);
});

test('generic engine: prompt includes full source and last slide without the giant Gemini instructions', () => {
  const slides = Array.from({ length: 18 }, (_, i) => ({
    number: i + 1, text: 'Slide về giao thông ' + (i + 1),
  }));
  const prompt = buildCompactGroqReviewPrompt({ ...input, slides }, [{ id: 'E1', text: input.transcript }]);
  assert.ok(prompt.includes(input.transcript));
  assert.ok(prompt.includes('Slide về giao thông 18'));
  assert.ok(prompt.includes('slideNumber'));
  assert.ok(prompt.length < 6000);
});

test('generic engine: no consent or invalid input fails before any provider call', async () => {
  const spy = mockedFetcher(() => mockResponse());
  for (const body of [
    { ...input, consent: false }, { ...input, transcript: 'Quá ngắn' },
    { ...input, slides: [{ number: 1, text: 'X' }, { number: 1, text: 'Y' }] },
  ]) {
    await assert.rejects(runGenericGroqReview({ input: body, apiKey: 'TEST_KEY', fetcher: spy.fetch }),
      { code: 'GROQ_INVALID_REQUEST' });
  }
  assert.equal(spy.calls, 0);
});

test('quality gate: malformed core and invalid or missing slide evidence fail closed', async () => {
  const invalidCore = { ...mockResponse(), strengths: mockResponse().strengths.slice(0, 1) };
  const badSpy = mockedFetcher(() => invalidCore);
  await assert.rejects(runGenericGroqReview({
    input, apiKey: 'TEST_KEY', fetcher: badSpy.fetch,
  }), { code: 'GROQ_REVIEW_STRUCTURE' });
  assert.equal(badSpy.calls, 1);
  for (const altered of [
    { ...mockResponse(), slideComparisons: mockResponse().slideComparisons.slice(0, 1) },
    { ...mockResponse(), slideComparisons: mockResponse().slideComparisons.map((item, i) =>
      i ? { ...item, slideQuote: 'Bịa trích dẫn hoàn toàn không tồn tại' } : item) },
  ]) {
    const spy = mockedFetcher(() => altered);
    await assert.rejects(runGenericGroqReview({
      input, apiKey: 'TEST_KEY', fetcher: spy.fetch,
    }), { code: 'GROQ_QUALITY_SLIDE_COVERAGE' });
    assert.equal(spy.calls, 1);
  }
});

test('generic engine: diacritics failure is distinguished from invalid evidence', async () => {
  const response = mockResponse();
  response.summary = 'Bai noi nay co nhieu noi dung ve cach di lai va giai phap ben vung.';
  const spy = mockedFetcher(() => response);
  await assert.rejects(runGenericGroqReview({ input, apiKey: 'TEST_KEY', fetcher: spy.fetch }),
    { code: 'GROQ_REVIEW_LANGUAGE' });
  assert.equal(spy.calls, 1);
});

test('generic engine: not connected to active learner Gemini route or any callable Preview endpoint', () => {
  const engine = readFileSync(new URL('../server/groqGenericReviewEngine.js', import.meta.url), 'utf8');
  const gemini = readFileSync(new URL('../api/ai/review.js', import.meta.url), 'utf8');
  assert.doesNotMatch(engine, /readSession\(|reserveGroqPilotQuota\(|export default function handler/u);
  assert.match(gemini, /new GoogleGenAI\(/u);
  assert.doesNotMatch(gemini, /groqGenericReviewEngine|GROQ_API_KEY/u);
});
