import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  listOfflineContractCases, makeOfflineContractFixture,
  validateOfflineContractFixture,
} from '../server/groqOfflineContractRehearsal.js';

const repoFile = relative => readFileSync(new URL('../' + relative, import.meta.url), 'utf8');
const allCases = listOfflineContractCases();

test('transition step 4: four fictional cases conform to existing validated result shape', () => {
  assert.equal(allCases.length, 4);
  for (const sample of allCases) {
    const result = validateOfflineContractFixture(sample.id);
    const review = result.review;
    assert.equal(result.source, 'offline-contract-mock');
    assert.equal(review.model, 'offline-contract-mock');
    assert.equal(review.strengths.length, 2);
    assert.equal(review.improvements.length, 2);
    assert.equal(review.slideComparisons.length, 2);
    assert.equal(review.slideOverview.length, 2);
    assert.equal(review.source, 'transcript_and_pptx');
    for (const item of review.strengths) {
      assert.ok(item.evidence.length > 30);
      assert.ok(item.point.length > 15);
    }
    for (const item of review.improvements) {
      assert.ok(item.evidence.length > 30);
      assert.ok(item.action.length > 15);
    }
    assert.deepEqual(review.slideComparisons.map(s => s.slideNumber), [1, 2]);
    assert.ok(review.limitations.some(l => l.includes('ASR')));
  }
});

test('transition step 4: unknown IDs cannot turn offline rehearsal into freeform text evaluation', () => {
  for (const id of [null, '', '../secret', '__proto__', 'student-transcript', {}, 5]) {
    assert.throws(() => makeOfflineContractFixture(id), { code: 'SYNTHETIC_CONTRACT_ONLY' });
  }
});

test('transition step 4: raw model-generated R1-R5 pilot is not falsely presented as actual review contract', () => {
  const pilot = repoFile('server/groqSyntheticCases.js');
  const current = repoFile('api/ai/review.js');
  const results = repoFile('src/features/history/AiSpeechReviewPanel.tsx');
  assert.match(pilot, /criteria:/u);
  assert.match(current, /parseGroundedReview\(output\.text, evidence, input\.slides\)/u);
  assert.match(results, /fetch\('\/api\/ai\/review'/u);
  assert.match(current, /new GoogleGenAI\(/u);
  assert.doesNotMatch(current, /requestGroqReview|GROQ_API_KEY|groqOfflineContractRehearsal/u);
  assert.doesNotMatch(results, /groq\/pilot|groqOfflineContractRehearsal/u);
});

test('transition step 4: no executable route can ingest student input for Groq pilot', () => {
  const pilotRoute = repoFile('api/groq/pilot.js');
  assert.match(pilotRoute, /env\.VERCEL_ENV !== 'preview'/u);
  assert.match(pilotRoute, /identity\.role !== 'teacher'/u);
  assert.match(pilotRoute, /getSyntheticCase\(request\.caseId\)/u);
  assert.match(pilotRoute, /request\.syntheticOnly !== true \|\| request\.confirmOneCall !== true/u);
  assert.doesNotMatch(pilotRoute, /request\.transcript|request\.slides|request\.studentId/u);
  const rehearsal = repoFile('server/groqOfflineContractRehearsal.js');
  assert.doesNotMatch(rehearsal, /requestGroqReview\(|fetch\(|\bGROQ_API_KEY\b/u);
});

test('transition step 4: simulated checkbox must not count as Groq parental consent', () => {
  const currentUI = repoFile('src/features/history/AiSpeechReviewPanel.tsx');
  assert.match(currentUI, /consent: true, sessionId/u);
  const privacy = repoFile('docs/GROQ_STUDENT_PRIVACY_DESIGN_PHASE_2_5.md');
  assert.match(privacy, /hồ sơ.*phía server/iu);
  assert.match(privacy, /NO-GO/u);
  const route = repoFile('api/groq/pilot.js');
  assert.doesNotMatch(route, /request\.consent|req\.body\.consent/u);
});
