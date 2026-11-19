/** Authenticated and opt-in AI council. Two controlled Gemini calls per completed 3-question practice. */
import { GoogleGenAI, Type } from '@google/genai';
import { readSession, isSameOriginRequest } from '../../server/sessionCookie.js';
import {
  FREE_REVIEW_MODEL, validateReviewRequest, makeEvidenceChunks, ensureFreeReviewConfigured,
  reserveReviewQuota, releaseReviewQuota, classifyReviewProviderError,
} from '../../server/freeSpeechReview.js';
import {
  buildDefenseQuestionsPrompt, parseDefenseQuestions, signDefenseChallenge, verifyDefenseChallenge,
  validateDefenseAnswers, buildDefenseFeedbackPrompt, parseDefenseFeedback,
} from '../../server/aiDefense.js';

const questionSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY, minItems: 3, maxItems: 3,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING }, evidenceId: { type: Type.STRING },
          slideNumber: { type: Type.INTEGER },
        },
        required: ['question', 'evidenceId', 'slideNumber'],
      },
    },
  },
  required: ['questions'],
};

const feedbackSchema = {
  type: Type.OBJECT,
  properties: {
    feedback: {
      type: Type.ARRAY, minItems: 3, maxItems: 3,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, enum: ['J1', 'J2', 'J3'] },
          answerQuote: { type: Type.STRING },
          covered: { type: Type.STRING }, missing: { type: Type.STRING },
          nextStep: { type: Type.STRING },
        },
        required: ['id', 'answerQuote', 'covered', 'missing', 'nextStep'],
      },
    },
  },
  required: ['feedback'],
};

function secureHeaders(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

export default async function handler(req, res) {
  secureHeaders(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST.' });
  }
  if (!isSameOriginRequest(req)) return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
  if (!/^application\/json(?:\s*;|\s*$)/iu.test(String(req.headers['content-type'] || ''))) {
    return res.status(415).json({ error: 'Dữ liệu phải là JSON.' });
  }
  const identity = readSession(req);
  if (!identity) return res.status(401).json({ error: 'Cần đăng nhập Google để luyện phản biện AI.' });

  let input, action, questions, answers;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (typeof raw !== 'string' || raw.length > 58000) {
      return res.status(413).json({ error: 'Dữ liệu gửi quá dài.' });
    }
    const body = JSON.parse(raw);
    if (!body || !['questions', 'feedback'].includes(body.action)) {
      return res.status(400).json({ error: 'Thao tác hội đồng AI không hợp lệ.' });
    }
    action = body.action;
    input = validateReviewRequest(body); // Requires explicit consent and validates topic, ASR and slide text.
    if (action === 'feedback') {
      answers = validateDefenseAnswers(body.answers);
      questions = verifyDefenseChallenge(body.challengeToken, input, identity.id,
        process.env.SPEAKLAB_SESSION_SECRET);
    }
  } catch (error) {
    if (error?.safePublic && error.status === 503) {
      return res.status(503).json({ code: error.publicCode || 'DEFENSE_NOT_CONFIGURED', error: error.message });
    }
    return res.status(400).json({ code: 'DEFENSE_INVALID_REQUEST',
      error: 'Nội dung phiên phản biện không hợp lệ, đã thay đổi hoặc đã hết thời gian. Hãy tạo câu hỏi mới nếu cần.' });
  }

  const quotaDate = new Date().toISOString().slice(0, 10);
  try {
    ensureFreeReviewConfigured();
    // The council shares the existing 5-per-day server-side Redis quota with AI speech review.
    // Generate 3 questions in ONE call; evaluate all 3 answers in ONE other call.
    const remainingToday = await reserveReviewQuota(identity.id, process.env, fetch, quotaDate);
    const evidence = makeEvidenceChunks(input.transcript);
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const generation = await client.models.generateContent({
      model: FREE_REVIEW_MODEL,
      contents: action === 'questions'
        ? buildDefenseQuestionsPrompt(input, evidence)
        : buildDefenseFeedbackPrompt(input, questions, answers, evidence),
      config: {
        temperature: 0.3,
        maxOutputTokens: action === 'questions' ? 2400 : 3700,
        responseMimeType: 'application/json',
        responseSchema: action === 'questions' ? questionSchema : feedbackSchema,
      },
    });
    const reason = generation.candidates?.[0]?.finishReason;
    if (reason === 'MAX_TOKENS' || reason === 'SAFETY' || !generation.text?.trim()) {
      console.warn('[SpeakLab defense] Incomplete or blocked model output.', {
        code: reason === 'MAX_TOKENS' ? 'DEFENSE_OUTPUT_LIMIT' : 'DEFENSE_EMPTY_OUTPUT',
      });
      return res.status(502).json({
        code: reason === 'MAX_TOKENS' ? 'DEFENSE_OUTPUT_LIMIT' : 'DEFENSE_EMPTY_OUTPUT',
        error: 'Gemini chưa trả đủ nội dung phản biện. Không tự gọi lại hoặc hiển thị nội dung thiếu căn cứ.',
      });
    }
    try {
      if (action === 'questions') {
        questions = parseDefenseQuestions(generation.text, evidence, input.slides);
        const challengeToken = signDefenseChallenge(questions, input, identity.id,
          process.env.SPEAKLAB_SESSION_SECRET);
        return res.status(200).json({ questions, challengeToken, remainingToday });
      }
      const feedback = parseDefenseFeedback(generation.text, questions, answers);
      return res.status(200).json({ feedback, remainingToday });
    } catch (error) {
      console.warn('[SpeakLab defense] Invalid model output.', {
        code: error?.publicCode || 'DEFENSE_INVALID_OUTPUT',
      });
      return res.status(502).json({
        code: error?.publicCode || 'DEFENSE_INVALID_OUTPUT',
        error: 'Gemini chưa tạo kết quả đủ cấu trúc hoặc căn cứ. Không hiển thị đánh giá chưa xác minh.',
      });
    }
  } catch (error) {
    if (error?.safePublic === true && [429, 503].includes(error?.status)) {
      return res.status(error.status).json({
        code: error.publicCode || 'SPEAKLAB_FREE_TIER_GUARD', error: error.message,
      });
    }
    const publicError = classifyReviewProviderError(error);
    if (publicError.code === 'GEMINI_TEMPORARILY_UNAVAILABLE') {
      const refunded = await releaseReviewQuota(identity.id, quotaDate);
      if (!refunded) console.warn('[SpeakLab defense] Quota refund failed.');
    }
    console.warn('[SpeakLab defense] Provider call failed.', {
      code: publicError.code, status: publicError.status,
    });
    return res.status(publicError.status).json(publicError);
  }
}
