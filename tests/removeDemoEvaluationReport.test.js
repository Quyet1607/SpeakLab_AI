import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('entire simulated evaluation page and report fallback modules are removed', () => {
  assert.equal(existsSync(new URL('../src/pages/ReportPage.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/services/reportService.ts', import.meta.url)), false);
  assert.doesNotMatch(read('src/data/mockData.ts'), /mockDefaultReport|reportId: 'rep_\d+'|overallScore:/u);
  assert.doesNotMatch(read('src/types/index.ts'), /EvaluationReport|EvaluationTimelineEvent|\| 'report'/u);
});

test('desktop and mobile navigation do not contain report page', () => {
  for (const path of ['src/components/common/Sidebar.tsx','src/components/common/MobileNav.tsx']) {
    assert.doesNotMatch(read(path), /id: 'report'|label: 'Báo cáo đánh giá'|badge: 'Demo'/u);
    assert.match(read(path), /id: 'history'/u);
  }
  assert.doesNotMatch(read('src/layouts/AppLayout.tsx'), /case 'report'/u);
});

test('dashboard and history preserve practice without fake grades or report links', () => {
  const app=read('src/App.tsx');
  assert.doesNotMatch(app, /ReportPage|reportService|selectedReportId|setSelectedReportId|onSelectSessionForReport|activePage === 'report'/u);
  const dashboard=read('src/pages/DashboardPage.tsx');
  const history=read('src/pages/HistoryPage.tsx');
  for(const source of [dashboard,history]){
    assert.doesNotMatch(source, /session\.score|session\.reportId|onNavigate\('report'\)|Điểm demo|Xem báo cáo|onSelectSessionForReport/u);
  }
  assert.match(history, /AiSpeechReviewPanel/u);
  assert.match(history, /listLocalVideos/u);
  assert.match(history, /deleteCompletedPracticeTranscript/u);
  assert.match(dashboard, /onNavigate\('history'\)/u);
});

test('false report notification and guidance are gone',()=>{
  assert.doesNotMatch(read('src/components/common/Header.tsx'), /Báo cáo đánh giá đã sẵn sàng|chấm demo/u);
  assert.doesNotMatch(read('src/pages/DashboardPage.tsx'), /Nhận báo cáo phân tích|Xem lại biểu đồ nhịp độ nói/u);
});
