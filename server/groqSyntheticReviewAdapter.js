/**
 * Step 5: OFFLINE, synthetic-only adapter from validated R1–R5 Groq Pilot
 * output to the existing SpeakLab review *display contract*.
 *
 * Not wired to API routes or browser. The reviewed R1–R5 template text is
 * deterministic for these fictional samples; this does NOT establish model
 * parity or authorize student data.
 */
import {
  getSyntheticCase, evidenceForSample, validateSyntheticCaseReview,
} from './groqSyntheticCases.js';
import { makeEvidenceChunks, parseGroundedReview } from './freeSpeechReview.js';

export const OFFLINE_GROQ_CONTRACT_MODEL = 'groq-synthetic-contract-offline';
const fail = () => Object.assign(new Error('Chỉ cho phép chuyển đổi dữ liệu giả lập đã kiểm chứng.'), {
  code: 'GROQ_SYNTHETIC_ADAPTER_REJECTED',
});

function evidenceSpan(source, chunks) {
  // For real user text, E# may vary; this adapter accepts ONLY four fixed
  // fictional transcripts. Never map arbitrary user-provided evidence.
  const chunk = chunks.find(item => item.text.includes(source));
  if (!chunk) throw fail();
  return chunk.id;
}

export function adaptVerifiedSyntheticGroqReview({ caseId, groqReview } = {}) {
  const sample = getSyntheticCase(caseId);
  if (!sample || !groqReview || typeof groqReview !== 'object' ||
      Array.isArray(groqReview)) throw fail();

  let checked, evidence;
  try {
    // Re-validate the actual R1–R5 IDs, necessary evidence sets and summary;
    // do not trust caller-provided quote, comments, or model identifiers.
    checked = validateSyntheticCaseReview(groqReview, sample);
    evidence = evidenceForSample(sample);
  } catch {
    throw fail();
  }

  const chunks = makeEvidenceChunks(sample.transcript);
  const slides = sample.slides.map((text, index) => ({ number: index + 1, text }));
  const by = new Map(checked.criteria.map(c => [c.criterion, c]));
  const inChunk = id => evidenceSpan(evidence[id], chunks);
  const solutionIds = ['SOLUTION_1', 'SOLUTION_2'];
  const candidates = {
    summary: checked.summary,
    strengths: [
      {
        point: by.get('R1').comment,
        evidenceId: inChunk('OPEN'),
      },
      {
        point: by.get('R5').comment,
        evidenceId: inChunk('SOLUTION_1'),
      },
    ],
    improvements: [
      {
        point: by.get('R3').comment,
        evidenceId: inChunk('LIMIT'),
        action: by.get('R3').suggestion,
      },
      {
        point: 'Bản ghi có phần mở đầu và kết thúc, nhưng cần giải thích rõ cách nối các ý ở giữa.',
        evidenceId: inChunk('CLOSE'),
        action: by.get('R2').suggestion,
      },
    ],
    slideComparisons: slides.map((slide, index) => {
      const solutionId = solutionIds[index];
      return {
        slideNumber: slide.number,
        // Text correspondence alone cannot prove the speaker actually
        // presented each slide or that all relevant points were covered.
        status: 'possible_difference',
        point: 'Đối chiếu văn bản slide với biện pháp được nhắc đến trong bản ghi lời nói.',
        slideQuote: slide.text,
        spokenQuote: evidence[solutionId],
        evidenceId: inChunk(solutionId),
        covered: 'Bản ghi có nhắc đến biện pháp tương ứng với chữ trên slide.',
        missing: 'Không có dữ liệu đồng bộ thời điểm nói và trình chiếu để kết luận đầy đủ.',
        action: by.get('R4').suggestion,
      };
    }),
    limitations: [
      'Đây là kết quả thử trên mẫu giả lập, không phải nhận xét bài thuyết trình thật.',
      'Nhận xét R1–R5 của bốn mẫu này đã được chuẩn hóa bằng nội dung rà soát trước.',
    ],
  };

  let review;
  try {
    // Shared existing validator checks E# references, slide quotes, speaking
    // quotes, Vietnamese prose, source limitation and output structure.
    review = parseGroundedReview(JSON.stringify(candidates), chunks, slides);
  } catch {
    throw fail();
  }
  if (review.strengths.length !== 2 || review.improvements.length !== 2 ||
      review.slideComparisons.length !== 2 || review.slideOverview.length !== 2 ||
      review.slideReviewStats?.accepted !== 2) throw fail();

  return {
    caseId,
    syntheticOnly: true,
    adapter: 'step-5-offline',
    review: { ...review, model: OFFLINE_GROQ_CONTRACT_MODEL },
  };
}
