/**
 * Preview-only server-owned multi-topic synthetic pilot.
 * No caller text is accepted; IDs resolve to the audited fictional fixture.
 */
import { SYNTHETIC_COMPARISON_CASES } from '../tests/fixtures/groqSyntheticComparisonCases.js';
import { requestGroqReview } from './groqReviewProvider.js';

const CRITERIA = Object.freeze(['R1', 'R2', 'R3', 'R4', 'R5']);
const FORBIDDEN = [
  /(?:phát âm|giọng điệu|ngữ điệu|âm lượng|ánh mắt|nét mặt|cử chỉ|tư thế|tốc độ nói|chất giọng|tự tin)/iu,
  /(?:bố cục|màu sắc|thiết kế|hình ảnh|slide đẹp|trình chiếu).{0,60}(?:tốt|đẹp|rõ|chuyên nghiệp|hiệu quả)/iu,
  /(?:điểm số|điểm tổng|\b\d+(?:[.,]\d+)?\s*\/\s*10\b)/iu,
];
// Internal evidence tokens belong in evidenceIds only, not in prose shown to learners.
const INTERNAL_CODES = /\\b(?:OPEN|CLOSE|LIMIT|SOLUTION_[12]|SLIDE_[12])\\b/iu;
const META_FEEDBACK = /(?:dẫn chứng|trích dẫn).{0,55}(?:không bị trùng|chính xác|được trích dẫn)|(?:giữ nguyên|đảm bảo).{0,40}(?:các? mã|evidenceIds)/iu;
const SPECIFIC_FEEDBACK = Object.freeze({
  'water-conservation': Object.freeze({
    R1: 'Em đã nêu hai cách tiết kiệm nước: khóa vòi khi đánh răng và tận dụng nước rửa rau để tưới cây phù hợp.',
    R1Suggestion: 'Hãy giải thích khi nào có thể dùng nước rửa rau để tưới cây và lưu ý tránh nước có chất tẩy rửa.',
    R3Suggestion: 'Có thể đo lượng nước sử dụng trước và sau khi thực hiện để kiểm tra mức tiết kiệm, chưa kết luận khi chưa có số liệu.',
    R5Suggestion: 'Nêu rõ cách thực hiện từng biện pháp và cách theo dõi kết quả trong một tuần.',
  }),
  'reading-habit': Object.freeze({
    R1: 'Em đã trình bày hai cách rèn thói quen đọc sách: đọc mười lăm phút mỗi tối và ghi câu hỏi sau khi đọc.',
    R1Suggestion: 'Hãy cho ví dụ một câu hỏi em sẽ ghi lại sau khi đọc một đoạn sách.',
    R3Suggestion: 'Có thể thử ghi lại thời gian đọc và khả năng trả lời câu hỏi trước khi kết luận cách này có ích cho đọc hiểu.',
    R5Suggestion: 'Giải thích cách duy trì việc đọc mỗi tối và cách kiểm tra các câu hỏi đã ghi.',
  }),
  'online-safety': Object.freeze({
    R1: 'Em nêu hai cách bảo vệ tài khoản: dùng mật khẩu dài và không chia sẻ, đồng thời bật xác thực hai bước khi được hỗ trợ.',
    R1Suggestion: 'Hãy minh họa tình huống một tài khoản được bảo vệ bằng xác thực hai bước và nhắc người nghe không chia sẻ mã xác minh.',
    R3Suggestion: 'Có thể tìm tài liệu hướng dẫn bảo mật đáng tin cậy để giải thích lợi ích, không tự đưa ra tỷ lệ giảm rủi ro.',
    R5Suggestion: 'Nêu rõ cách thực hiện từng biện pháp và giải thích vì sao cả mật khẩu lẫn bước xác minh bổ sung đều cần thiết.',
  }),
  'school-garden': Object.freeze({
    R1: 'Em đề xuất phân công lịch tưới và thu gom lá khô để ủ phân chăm sóc vườn cây chung.',
    R1Suggestion: 'Hãy đưa ví dụ lịch phân công tưới cây và cách thu gom lá khô phù hợp.',
    R3Suggestion: 'Có thể theo dõi sự phát triển của cây theo tuần trước khi đánh giá hiệu quả của hai biện pháp.',
    R5Suggestion: 'Nêu ai phụ trách lịch tưới và các bước ủ lá khô an toàn để người nghe có thể thực hiện.',
  }),
});
function learnerProse(text) {
  return !INTERNAL_CODES.test(text) && !META_FEEDBACK.test(text);
}
function groundedCriterion(criterion, sample, evidence) {
  const details = SPECIFIC_FEEDBACK[sample.id];
  if (!details) throw invalid();
  if (criterion === 'R1') return {
    comment: details.R1,
    suggestion: details.R1Suggestion,
  };
  if (criterion === 'R3') return {
    comment: 'Bài nói thừa nhận chưa có bằng chứng để kết luận hiệu quả: ' + evidence.LIMIT,
    suggestion: details.R3Suggestion,
  };
  if (criterion === 'R5') return {
    comment: 'Bài nói đã đề cập đủ hai biện pháp: ' + evidence.SOLUTION_1 + ' ' + evidence.SOLUTION_2,
    suggestion: details.R5Suggestion,
  };
  throw invalid();
}

const outputSchema = {
  type: 'object', additionalProperties: false,
  required: ['summary', 'criteria', 'limitations'],
  properties: {
    summary: { type: 'string' },
    criteria: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['criterion', 'comment', 'evidenceIds', 'suggestion'],
        properties: {
          criterion: { type: 'string', enum: CRITERIA },
          comment: { type: 'string' },
          evidenceIds: { type: 'array', items: { type: 'string', enum: ['OPEN', 'SOLUTION_1', 'SOLUTION_2', 'LIMIT', 'CLOSE', 'SLIDE_1', 'SLIDE_2'] } },
          suggestion: { type: 'string' },
        },
      },
    },
    limitations: { type: 'string' },
  },
};

function invalid() {
  return Object.assign(new Error('Kết quả chưa vượt qua kiểm chứng dẫn chứng giả lập.'), { code: 'GROQ_INVALID_REVIEW' });
}
function safeText(input, min = 5, max = 700) {
  if (typeof input !== 'string' || input.trim().length < min || input.length > max ||
      FORBIDDEN.some(rule => rule.test(input)) || INTERNAL_CODES.test(input)) throw invalid();
  return input.trim();
}
export function syntheticCaseList() {
  return SYNTHETIC_COMPARISON_CASES.map(({ id, label, topic }) => ({ id, label, topic }));
}
export function getSyntheticCase(id) {
  if (typeof id !== 'string') return null;
  return SYNTHETIC_COMPARISON_CASES.find(sample => sample.id === id) || null;
}
export function evidenceForSample(sample) {
  const sentences = sample.transcript.split(/(?<=\.)\s+/u).map(x => x.trim());
  if (sentences.length !== 5 || sample.slides.length !== 2) throw invalid();
  const evidence = {
    OPEN: sentences[0],
    SOLUTION_1: sentences[1],
    SOLUTION_2: sentences[2],
    LIMIT: sentences[3],
    CLOSE: sentences[4],
    SLIDE_1: sample.slides[0],
    SLIDE_2: sample.slides[1],
  };
  return evidence;
}
export function makeSyntheticCaseRequest(sample) {
  const e = evidenceForSample(sample);
  const sources = Object.entries(e).map(([id, quote]) => id + ': ' + JSON.stringify(quote)).join('\n');
  return {
    prompt: [
      'CHỈ DỮ LIỆU GIẢ LẬP ĐÃ VIẾT SẴN, KHÔNG PHẢI BÀI HỌC SINH.',
      'Đề tài: ' + sample.topic,
      'Mục tiêu: ' + sample.goal,
      'Bản ghi: ' + sample.transcript,
      'Slide 1: ' + sample.slides[0],
      'Slide 2: ' + sample.slides[1],
      'Nguồn dẫn chứng server cấp (chỉ chọn ID, không sáng tác trích dẫn):\n' + sources,
      'Trả đúng 5 tiêu chí R1–R5, tiếng Việt có dấu, không chấm điểm.',
      'R1: chọn OPEN và ít nhất một SOLUTION_1 hoặc SOLUTION_2.',
      'R2: chọn OPEN và CLOSE; không suy luận rằng toàn bộ lập luận mạch lạc chỉ từ mở/kết.',
      'R3: chọn LIMIT; không bịa ra số liệu đo lường.',
      'R4: chọn SLIDE_1, SOLUTION_1, SLIDE_2, SOLUTION_2. Chỉ ghép chữ; không đánh giá hình ảnh hay thiết kế.',
      'R5: chọn SOLUTION_1 và SOLUTION_2; chỉ mô tả các biện pháp được nhắc đến.',
      'Không mô tả chất giọng, ánh mắt, cử chỉ, cách trình chiếu, điểm số hoặc dữ liệu thực nghiệm chưa có.',
      'Trả summary, criteria gồm criterion/comment/evidenceIds/suggestion, limitations theo JSON schema.',
      'Các mã OPEN, CLOSE, LIMIT, SOLUTION_1, SOLUTION_2, SLIDE_1, SLIDE_2 CHỈ được ghi ở evidenceIds; không bao giờ viết mã này trong summary, comment, suggestion hay limitations.',
      'Lời nhận xét dành cho người học phải nói trực tiếp về hai biện pháp trong bài. Không hướng dẫn kiểm tra mã dẫn chứng, không đưa gợi ý chung chung về trích dẫn; hãy gợi ý bước cải thiện cụ thể phù hợp với đề tài.',
    ].join('\n'),
    schema: outputSchema,
  };
}
export function validateSyntheticCaseReview(response, sample) {
  const e = evidenceForSample(sample);
  if (!response || typeof response !== 'object' || Array.isArray(response) ||
      !Array.isArray(response.criteria) || response.criteria.length !== 5) throw invalid();
  const summary = safeText(response.summary, 10);
  const limitations = safeText(response.limitations, 10);
  const byId = new Map();
  for (const item of response.criteria) {
    if (!item || !CRITERIA.includes(item.criterion) || byId.has(item.criterion) ||
        !Array.isArray(item.evidenceIds) || !item.evidenceIds.length ||
        new Set(item.evidenceIds).size !== item.evidenceIds.length ||
        item.evidenceIds.some(id => !Object.hasOwn(e, id))) throw invalid();
    // R2/R4 model prose is discarded in favor of checked conservative wording.
    if (typeof item.comment !== 'string' || item.comment.trim().length < 5 ||
        typeof item.suggestion !== 'string' || item.suggestion.trim().length < 5) throw invalid();
    if (!['R2', 'R4'].includes(item.criterion)) {
      safeText(item.comment, 5, 550);
      safeText(item.suggestion, 5, 550);
    }
    const required = {
      R1: ['OPEN'], R2: ['OPEN', 'CLOSE'], R3: ['LIMIT'],
      R4: ['SLIDE_1', 'SOLUTION_1', 'SLIDE_2', 'SOLUTION_2'],
      R5: ['SOLUTION_1', 'SOLUTION_2'],
    }[item.criterion];
    if (required.some(id => !item.evidenceIds.includes(id))) throw invalid();
    if (item.criterion === 'R1' && !item.evidenceIds.some(id => ['SOLUTION_1', 'SOLUTION_2'].includes(id))) throw invalid();
    const allowed = {
      R1: ['OPEN', 'SOLUTION_1', 'SOLUTION_2'],
      R2: ['OPEN', 'CLOSE'], R3: ['LIMIT'],
      R4: ['SLIDE_1', 'SOLUTION_1', 'SLIDE_2', 'SOLUTION_2'],
      R5: ['SOLUTION_1', 'SOLUTION_2'],
    }[item.criterion];
    if (item.evidenceIds.some(id => !allowed.includes(id))) throw invalid();
    byId.set(item.criterion, item);
  }
  const criteria = CRITERIA.map(criterion => {
    const item = byId.get(criterion);
    if (!item) throw invalid();
    let comment = item.comment.trim();
    let suggestion = item.suggestion.trim();
    // Prevent exposing test jargon or generic rubric/meta-feedback to learners.
    // Preserve verified evidence IDs; switch to reviewed, topic-specific wording.
    if (['R1', 'R3', 'R5'].includes(criterion) &&
        (!learnerProse(comment) || !learnerProse(suggestion))) {
      ({ comment, suggestion } = groundedCriterion(criterion, sample, e));
    }
    if (criterion === 'R2') {
      comment = 'Bản ghi có phần mở đầu và kết thúc. Hai dấu mốc chưa đủ để kết luận toàn bộ mạch lập luận.';
      suggestion = 'Có thể bổ sung câu chuyển ý rõ ràng giữa các biện pháp.';
    }
    if (criterion === 'R4') {
      comment = 'Chữ trên hai slide tương ứng với các biện pháp được nhắc tới trong bài nói.';
      suggestion = 'Chỉ đối chiếu văn bản, không đánh giá bố cục, hình ảnh hoặc chất lượng trình chiếu.';
    }
    return { criterion, comment, suggestion, evidenceIds: item.evidenceIds, quote: item.evidenceIds.map(id => e[id]).join(' | ') };
  });
  return { summary, limitations, criteria };
}
export async function runSyntheticCase({ id, apiKey, fetcher = fetch } = {}) {
  const sample = getSyntheticCase(id);
  if (!sample) throw Object.assign(new Error('Không có bài giả lập được chọn.'), { code: 'GROQ_INVALID_CASE' });
  const { prompt, schema } = makeSyntheticCaseRequest(sample);
  const result = await requestGroqReview({ apiKey, prompt, schema, maxOutputTokens: 2600, fetcher, timeoutMs: 30000 });
  let parsed;
  try { parsed = JSON.parse(result.text); } catch { throw invalid(); }
  return { model: result.model, review: validateSyntheticCaseReview(parsed, sample), sample: { id: sample.id, label: sample.label, topic: sample.topic } };
}
