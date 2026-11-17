import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SYNTHETIC_COMPARISON_CASES } from './fixtures/groqSyntheticComparisonCases.js';
import { SAMPLE, makeRequest } from '../scripts/groqSyntheticPilot.mjs';

test('transition stage 1: comparison corpus has diverse, stable fictional samples', () => {
  assert.equal(SYNTHETIC_COMPARISON_CASES.length, 4);
  const ids = new Set();
  const topics = new Set();
  for (const sample of SYNTHETIC_COMPARISON_CASES) {
    assert.match(sample.id, /^[a-z]+(?:-[a-z]+)*$/);
    assert.ok(!ids.has(sample.id)); ids.add(sample.id);
    assert.ok(!topics.has(sample.topic)); topics.add(sample.topic);
    for (const key of ['label', 'topic', 'goal', 'transcript']) {
      assert.equal(typeof sample[key], 'string');
      assert.ok(sample[key].trim().length >= 8);
    }
    assert.ok(sample.transcript.length >= 120 && sample.transcript.length <= 24000);
    assert.equal(sample.slides.length, 2);
    assert.ok(sample.slides.every(slide => typeof slide === 'string' && slide.trim().length > 10));
    assert.ok(sample.expectedChecks.length >= 3);
    assert.ok(sample.expectedChecks.every(check => check.trim().length >= 12));
    assert.match(sample.transcript, /chưa /u, sample.id + ' must contain uncertainty requiring grounded feedback');
    assert.doesNotMatch(JSON.stringify(sample), /@[a-z0-9.-]+\.[a-z]{2,}|\b\d{9,12}\b|https?:\/\//iu);
  }
});

test('transition stage 2: corpus is only accessible through server allowlisted IDs', () => {
  const request = makeRequest();
  assert.ok(request.messages[1].content.includes(SAMPLE.transcript));
  for (const sample of SYNTHETIC_COMPARISON_CASES) {
    assert.ok(!request.messages[1].content.includes(sample.transcript));
  }
  const pilot = readFileSync(new URL('../api/groq/pilot.js', import.meta.url), 'utf8');
  assert.match(pilot, /Object\.keys\(request\)\.length !== 2/);
  assert.match(pilot, /request\.syntheticOnly !== true \|\| request\.confirmOneCall !== true/);
  assert.match(pilot, /getSyntheticCase\(request\.caseId\)/u);
  assert.match(pilot, /Object\.hasOwn\(request, 'caseId'\) && !requestedCase/u);
  assert.doesNotMatch(pilot, /request\.transcript|request\.slides|request\.email/u);
});

test('transition stage 1: exercises explicitly prohibit undocumented scoring and modality claims', () => {
  const serialized = JSON.stringify(SYNTHETIC_COMPARISON_CASES);
  assert.ok(SYNTHETIC_COMPARISON_CASES.some(sample => sample.expectedChecks.some(check => /Không tự tạo|Không bịa/u.test(check))));
  assert.ok(SYNTHETIC_COMPARISON_CASES.some(sample => sample.expectedChecks.some(check => /Không suy đoán|không nhận xét/u.test(check))));
  assert.doesNotMatch(serialized, /"score"\s*:|"rating"\s*:/u);
});
