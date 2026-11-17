import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GROQ_CHAT_COMPLETIONS_URL,
  GROQ_REVIEW_MODEL,
  buildGroqReviewRequest,
  requestGroqReview,
  toGroqJsonSchema,
} from '../server/groqReviewProvider.js';
import {
  makeEvidenceChunks,
  parseGroundedReview,
} from '../server/freeSpeechReview.js';

const schema = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    strengths: {
      type: 'ARRAY',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'OBJECT',
        properties: {
          point: { type: 'STRING' },
          evidenceId: { type: 'STRING' },
        },
        required: ['point', 'evidenceId'],
      },
    },
    improvements: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          point: { type: 'STRING' },
          evidenceId: { type: 'STRING' },
          action: { type: 'STRING' },
        },
        required: ['point', 'evidenceId', 'action'],
      },
    },
    slideComparisons: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          slideNumber: { type: 'INTEGER' },
          status: { type: 'STRING', enum: ['matched', 'partial', 'not_found', 'possible_difference'] },
          point: { type: 'STRING' },
          slideQuote: { type: 'STRING' },
          spokenQuote: { type: 'STRING' },
          evidenceId: { type: 'STRING' },
          covered: { type: 'STRING' },
          missing: { type: 'STRING' },
          action: { type: 'STRING' },
        },
        required: ['slideNumber', 'status', 'point', 'slideQuote', 'spokenQuote', 'evidenceId', 'covered', 'missing', 'action'],
      },
    },
    limitations: { type: 'ARRAY', items: { type: 'STRING' }, maxItems: 4 },
  },
  required: ['summary', 'strengths', 'improvements', 'slideComparisons', 'limitations'],
};

const prompt = 'DỮ LIỆU GIẢ LẬP. Hãy nhận xét nội dung bài nói và chỉ trả về JSON theo schema.';
const transcript = 'Hôm nay em trình bày về việc bảo vệ dữ liệu cá nhân. ' +
  'Trước tiên cần đặt mật khẩu mạnh và bật xác thực nhiều bước. ' +
  'Tiếp theo chúng ta tránh cung cấp mật khẩu cho người lạ. Em xin cảm ơn.';

function validReview() {
  return {
    summary: 'Bài nói giới thiệu chủ đề bảo vệ dữ liệu cá nhân và nêu giải pháp cụ thể.',
    strengths: [
      { point: 'Bài nói nêu chủ đề ngay từ phần mở đầu.', evidenceId: 'E1' },
      { point: 'Bài nói đề xuất sử dụng mật khẩu mạnh.', evidenceId: 'E1' },
    ],
    improvements: [
      {
        point: 'Cần giải thích rõ hơn tình huống áp dụng xác thực nhiều bước.',
        evidenceId: 'E1',
        action: 'Bổ sung ví dụ khi tài khoản đăng nhập từ thiết bị lạ.',
      },
      {
        point: 'Nên làm rõ cách kiểm chứng hiệu quả của giải pháp.',
        evidenceId: 'E1',
        action: 'Nêu một cách khảo sát đơn giản và kết quả cần thu thập.',
      },
    ],
    slideComparisons: [],
    limitations: ['Bản ghi ASR có thể sai và không có âm thanh để đánh giá giọng nói.'],
  };
}

function mockResponse(content, finishReason = 'stop') {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ finish_reason: finishReason, message: { content } }],
    }),
  };
}

test('converts the existing assessment schema to strict Groq JSON Schema', () => {
  const converted = toGroqJsonSchema(schema);
  assert.equal(converted.type, 'object');
  assert.equal(converted.additionalProperties, false);
  assert.deepEqual(converted.required, Object.keys(schema.properties));
  assert.equal(converted.properties.strengths.type, 'array');
  assert.equal(converted.properties.strengths.items.additionalProperties, false);
  assert.deepEqual(
    converted.properties.slideComparisons.items.properties.status.enum,
    ['matched', 'partial', 'not_found', 'possible_difference'],
  );
  // Array cardinality remains enforced by the existing server-side validator.
  assert.equal('minItems' in converted.properties.strengths, false);
  assert.equal('maxItems' in converted.properties.strengths, false);
  assert.throws(() => toGroqJsonSchema({ type: 'UNSUPPORTED' }), { code: 'GROQ_SCHEMA_INVALID' });
});

test('builds a fixed-model request with strict JSON output and no credential in its body', () => {
  const request = buildGroqReviewRequest({ prompt, schema, maxOutputTokens: 12000 });
  assert.equal(request.model, GROQ_REVIEW_MODEL);
  assert.equal(request.model, 'openai/gpt-oss-20b');
  assert.equal(request.stream, false);
  assert.equal(request.max_completion_tokens, 12000);
  assert.equal(request.reasoning_effort, 'low');
  assert.equal(request.response_format.type, 'json_schema');
  assert.equal(request.response_format.json_schema.strict, true);
  assert.equal(request.response_format.json_schema.schema.additionalProperties, false);
  assert.equal(request.messages[1].content, prompt);
  assert.doesNotMatch(JSON.stringify(request), /api[_-]?key|DUMMY_TEST_TOKEN/u);
  assert.throws(() => buildGroqReviewRequest({ prompt: '', schema }));
  assert.throws(() => buildGroqReviewRequest({ prompt, schema, maxOutputTokens: 999999 }));
});

test('mocked Groq response passes through the existing grounded review validator unchanged', async () => {
  let calls = 0;
  const apiKey = 'DUMMY_TEST_TOKEN_NOT_A_SECRET';
  const expected = validReview();
  const result = await requestGroqReview({
    apiKey,
    prompt,
    schema,
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, GROQ_CHAT_COMPLETIONS_URL);
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer ' + apiKey);
      const body = JSON.parse(options.body);
      assert.equal(body.model, GROQ_REVIEW_MODEL);
      assert.equal(body.messages[1].content, prompt);
      assert.equal(body.response_format.json_schema.strict, true);
      assert.equal(body.messages.some(message => message.content.includes(transcript)), false);
      return mockResponse(JSON.stringify(expected));
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.model, GROQ_REVIEW_MODEL);
  const evidence = makeEvidenceChunks(transcript);
  const review = parseGroundedReview(result.text, evidence, []);
  assert.equal(review.summary, expected.summary);
  assert.equal(review.strengths.length, 2);
  assert.equal(review.improvements.length, 2);
  assert.equal(review.source, 'transcript');
  assert.equal(review.strengths[0].evidence, evidence[0].text);
});

test('missing key fails before network and the adapter never retries', async () => {
  let calls = 0;
  await assert.rejects(
    requestGroqReview({ apiKey: '', prompt, schema, fetcher: async () => { calls++; } }),
    error => error.code === 'GROQ_CONFIG',
  );
  assert.equal(calls, 0);

  const rateLimited = await requestGroqReview({
    apiKey: 'DUMMY_TEST_TOKEN',
    prompt,
    schema,
    fetcher: async () => {
      calls++;
      return { ok: false, status: 429 };
    },
  }).catch(error => error);
  assert.equal(rateLimited.code, 'GROQ_RATE_LIMIT');
  assert.equal(calls, 1);
  assert.doesNotMatch(rateLimited.message, /DUMMY_TEST_TOKEN/u);
});

test('upstream auth and service errors are redacted', async () => {
  for (const [status, code] of [[401, 'GROQ_ACCESS_DENIED'], [403, 'GROQ_ACCESS_DENIED'], [404, 'GROQ_MODEL_UNAVAILABLE'], [503, 'GROQ_UPSTREAM_HTTP']]) {
    await assert.rejects(
      requestGroqReview({
        apiKey: 'DUMMY_TEST_TOKEN',
        prompt,
        schema,
        fetcher: async () => ({ ok: false, status, text: async () => 'PRIVATE_UPSTREAM_RESPONSE' }),
      }),
      error => {
        assert.equal(error.code, code);
        assert.doesNotMatch(error.message, /PRIVATE_UPSTREAM_RESPONSE|DUMMY_TEST_TOKEN/u);
        return true;
      },
    );
  }
});

test('rejects truncated, malformed, and non-object provider responses', async () => {
  const call = content => requestGroqReview({
    apiKey: 'DUMMY_TEST_TOKEN',
    prompt,
    schema,
    fetcher: async () => mockResponse(content),
  });
  await assert.rejects(
    requestGroqReview({
      apiKey: 'DUMMY_TEST_TOKEN', prompt, schema,
      fetcher: async () => mockResponse('', 'length'),
    }),
    error => error.code === 'GROQ_OUTPUT_LIMIT',
  );
  await assert.rejects(call('not JSON'), error => error.code === 'GROQ_INVALID_RESPONSE');
  await assert.rejects(call('[]'), error => error.code === 'GROQ_INVALID_RESPONSE');
  await assert.rejects(call(''), error => error.code === 'GROQ_INVALID_RESPONSE');
});

test('network failures are safe and do not trigger a second request', async () => {
  let calls = 0;
  await assert.rejects(
    requestGroqReview({
      apiKey: 'DUMMY_TEST_TOKEN',
      prompt,
      schema,
      fetcher: async () => {
        calls++;
        throw new Error('PRIVATE_NETWORK_DETAIL_AND_TOKEN');
      },
    }),
    error => {
      assert.equal(error.code, 'GROQ_NETWORK');
      assert.doesNotMatch(error.message, /PRIVATE_NETWORK_DETAIL_AND_TOKEN|DUMMY_TEST_TOKEN/u);
      return true;
    },
  );
  assert.equal(calls, 1);
});
