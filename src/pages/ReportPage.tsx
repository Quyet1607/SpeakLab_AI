/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileCheck,
  Calendar,
  Clock,
  Play,
  Pause,
  Award,
  TrendingUp,
  Activity,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Download,
  Share2,
  RotateCcw,
  Sparkles,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import { EvaluationReport, ActivePage } from '../types';
import { Button } from '../components/ui/Button';
import { DemoNotice } from '../components/ui/DemoNotice';

interface ReportPageProps {
  report: EvaluationReport;
  onNavigate: (page: ActivePage) => void;
  onPracticeAgain: () => void;
}

export const ReportPage: React.FC<ReportPageProps> = ({
  report,
  onNavigate,
  onPracticeAgain,
}) => {
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [currentVideoTime, setCurrentVideoTime] = useState(75); // 01:15
  const [selectedEventId, setSelectedEventId] = useState<number | null>(75);
  const [showExportNotice, setShowExportNotice] = useState(false);

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6">
      {/* Demo Notice */}
      <DemoNotice
        title="Bản Demo Báo cáo Đánh giá Thuyết trình"
        message="Tất cả biểu đồ nhịp độ nói, tần suất từ đệm và nhận xét từ hội đồng là dữ liệu mô phỏng minh họa. Trong Đợt 2, hệ thống sẽ sử dụng mô hình AI xử lý âm thanh tiếng Việt và thị giác máy tính để tự động trích xuất các chỉ số này từ webcam và micro thực tế."
      />

      {/* Report Header Card */}
      <div className="bg-white rounded-2xl border border-[#E4E9E3] p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-[#EEF4F0] text-[#324C3B] border border-[#D9E5DC]">
              {report.modeTitle}
            </span>
            <span className="text-xs text-[#768078]">
              Mã báo cáo: #{report.id}
            </span>
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-[#3D4740] tracking-tight">
            {report.sessionTitle}
          </h2>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#768078] pt-1">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#5A7D65]" />
              <span>{report.dateFormatted}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#5A7D65]" />
              <span>Thời lượng: {report.durationFormatted}</span>
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={() => setShowExportNotice(true)}
          >
            Xuất PDF (Mô phỏng)
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={onPracticeAgain}
          >
            Luyện tập lại
          </Button>
        </div>
      </div>

      {showExportNotice && (
        <div className="p-3 bg-[#EEF4F0] rounded-xl border border-[#D9E5DC] text-xs text-[#324C3B] flex items-center justify-between animate-in fade-in">
          <span>
            Tính năng xuất PDF chi tiết kèm dấu mộc đánh giá của hội đồng sẽ khả dụng ở Đợt 2.
          </span>
          <button
            onClick={() => setShowExportNotice(false)}
            className="text-xs font-semibold underline ml-2"
          >
            Đóng
          </button>
        </div>
      )}

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Overall Score */}
        <div className="bg-white rounded-xl border border-[#E4E9E3] p-3.5 sm:p-4 shadow-xs">
          <span className="text-[11px] font-medium text-[#768078] block truncate">Điểm tổng quan (Demo)</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl md:text-3xl font-bold text-[#3D5C46] tabular-nums">
              {report.overallScore}
            </span>
            <span className="text-xs text-[#768078]">/ 10</span>
          </div>
          <p className="text-[10px] text-[#5A7D65] mt-1 font-semibold truncate">Xuất sắc (Minh họa)</p>
        </div>

        {/* Speech Pace */}
        <div className="bg-white rounded-xl border border-[#E4E9E3] p-3.5 sm:p-4 shadow-xs">
          <span className="text-[11px] font-medium text-[#768078] block truncate">Tốc độ nói (Demo)</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl md:text-3xl font-bold text-[#3D4740] tabular-nums">
              {report.metrics.speechPaceWpm}
            </span>
            <span className="text-xs text-[#768078]">từ/phút</span>
          </div>
          <p className="text-[10px] text-[#5A7D65] mt-1 font-medium truncate">Khoảng chuẩn (120-140)</p>
        </div>

        {/* Eye Contact */}
        <div className="bg-white rounded-xl border border-[#E4E9E3] p-3.5 sm:p-4 shadow-xs">
          <span className="text-[11px] font-medium text-[#768078] block truncate">Giao tiếp mắt (Demo)</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl md:text-3xl font-bold text-[#3D4740] tabular-nums">
              {report.metrics.eyeContactPercentage}%
            </span>
            <span className="text-xs text-[#768078]">thời lượng</span>
          </div>
          <p className="text-[10px] text-[#5A7D65] mt-1 font-medium truncate">Tập trung hội đồng</p>
        </div>

        {/* Filler Words */}
        <div className="bg-white rounded-xl border border-[#E4E9E3] p-3.5 sm:p-4 shadow-xs">
          <span className="text-[11px] font-medium text-[#768078] block truncate">Từ đệm (Demo)</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl md:text-3xl font-bold text-[#3D4740] tabular-nums">
              {report.metrics.fillerWordsCount}
            </span>
            <span className="text-xs text-[#768078]">lần</span>
          </div>
          <p className="text-[10px] text-[#768078] mt-1 truncate">Số liệu minh họa</p>
        </div>

        {/* Clarity */}
        <div className="bg-white rounded-xl border border-[#E4E9E3] p-3.5 sm:p-4 shadow-xs">
          <span className="text-[11px] font-medium text-[#768078] block truncate">Mạch lạc (Demo)</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl md:text-3xl font-bold text-[#3D4740] tabular-nums">
              {report.metrics.clarityScore}
            </span>
            <span className="text-xs text-[#768078]">/ 10</span>
          </div>
          <p className="text-[10px] text-[#5A7D65] mt-1 font-medium truncate">Truyền đạt rành mạch</p>
        </div>

        {/* Defense score */}
        <div className="bg-white rounded-xl border border-[#E4E9E3] p-3.5 sm:p-4 shadow-xs">
          <span className="text-[11px] font-medium text-[#768078] block truncate">Phản biện (Demo)</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl md:text-3xl font-bold text-[#3D4740] tabular-nums">
              {report.metrics.defenseScore}
            </span>
            <span className="text-xs text-[#768078]">/ 10</span>
          </div>
          <p className="text-[10px] text-[#5A7D65] mt-1 font-medium truncate">Lập luận có dẫn chứng</p>
        </div>
      </div>

      {/* Main Analysis Section: Video Replay Placeholder & Interactive Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Video Replay Placeholder (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E4E9E3] p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E4E9E3]">
            <div>
              <h3 className="text-base font-bold text-[#3D4740]">
                Phát lại video buổi thuyết trình
              </h3>
              <p className="text-xs text-[#768078] mt-0.5">
                Xem lại các thời điểm hội đồng đặt câu hỏi hoặc thời điểm cần cải thiện
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#4A6453] bg-[#EEF4F0] px-2 py-0.5 rounded border border-[#D9E5DC]">
              {formatSeconds(currentVideoTime)} / 12:25
            </span>
          </div>

          {/* Video Placeholder Container */}
          <div className="relative aspect-video rounded-xl bg-[#1C231E] border border-[#2D3830] overflow-hidden flex flex-col items-center justify-center p-6 text-center select-none shadow-inner">
            {/* Overlay Simulated Screen */}
            <div className="absolute inset-0 bg-radial from-transparent to-black/60 pointer-events-none" />

            <div className="relative z-10 space-y-2">
              <button
                onClick={() => setIsPlayingVideo(!isPlayingVideo)}
                className="w-14 h-14 rounded-full bg-[#83A58E] hover:bg-[#6F917A] text-white flex items-center justify-center mx-auto shadow-lg transition-transform hover:scale-105 cursor-pointer"
              >
                {isPlayingVideo ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </button>

              <p className="text-xs font-semibold text-white">
                Khung xem lại video buổi thuyết trình (Mô phỏng Đợt 1)
              </p>
              <p className="text-[11px] text-[#A8B6AB] max-w-sm mx-auto">
                Trong Đợt 2, video ghi hình kèm âm thanh thực tế của bạn sẽ được đồng bộ chính xác với thanh tiến trình và sự kiện bên dưới.
              </p>
            </div>

            {/* Video Controls Timeline Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-1.5 z-10">
              {/* Scrubbing Bar */}
              <div className="relative h-2 bg-white/20 rounded-full cursor-pointer overflow-hidden">
                <div
                  style={{ width: `${(currentVideoTime / 745) * 100}%` }}
                  className="h-full bg-[#83A58E] rounded-full transition-all"
                />
              </div>

              {/* Marker Pins */}
              <div className="relative h-4 -mt-3 pointer-events-none">
                {report.timelineEvents.map((evt) => {
                  const leftPercent = (evt.timeInSeconds / 745) * 100;
                  return (
                    <div
                      key={evt.timeInSeconds}
                      style={{ left: `${leftPercent}%` }}
                      className="absolute top-1 -translate-x-1/2 w-2.5 h-2.5 rounded-full border border-white cursor-pointer pointer-events-auto transition-transform hover:scale-150"
                      title={`${evt.timeFormatted}: ${evt.title}`}
                      onClick={() => {
                        setCurrentVideoTime(evt.timeInSeconds);
                        setSelectedEventId(evt.timeInSeconds);
                      }}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[10px] text-white/80">
                <span>{formatSeconds(currentVideoTime)}</span>
                <span>12:25</span>
              </div>
            </div>
          </div>

          {/* Selected Event Details below video */}
          {selectedEventId && (
            <div className="p-3.5 rounded-xl bg-[#FAFBF9] border border-[#E4E9E3] space-y-1">
              {(() => {
                const evt =
                  report.timelineEvents.find((e) => e.timeInSeconds === selectedEventId) ||
                  report.timelineEvents[0];
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#3D4740] flex items-center gap-1.5">
                        <span className="font-mono text-[#4A6453]">[{evt.timeFormatted}]</span>
                        <span>{evt.title}</span>
                      </span>
                      {evt.slideNumber && (
                        <span className="text-[10px] text-[#768078]">
                          Slide {evt.slideNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#556057] leading-relaxed">
                      {evt.description}
                    </p>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Timeline Events List (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E4E9E3] p-5 md:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-[#3D4740]">
              Các mốc thời gian cần xem lại
            </h3>
            <p className="text-xs text-[#768078] mt-0.5">
              Bấm vào mốc để nhảy video đến đúng thời điểm
            </p>

            <div className="mt-4 space-y-3">
              {report.timelineEvents.map((evt) => {
                const isSelected = selectedEventId === evt.timeInSeconds;

                return (
                  <div
                    key={evt.timeInSeconds}
                    onClick={() => {
                      setSelectedEventId(evt.timeInSeconds);
                      setCurrentVideoTime(evt.timeInSeconds);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#EEF4F0] border-[#83A58E] shadow-2xs'
                        : 'bg-white border-[#E4E9E3] hover:bg-[#F7F9F6]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-[#324C3B] bg-white px-2 py-0.5 rounded border border-[#D9E5DC]">
                          {evt.timeFormatted}
                        </span>
                        <span className="text-xs font-semibold text-[#3D4740]">
                          {evt.title}
                        </span>
                      </div>
                      {evt.type === 'positive' && (
                        <CheckCircle2 className="w-4 h-4 text-[#5A7D65] shrink-0" />
                      )}
                      {evt.type === 'warning' && (
                        <AlertTriangle className="w-4 h-4 text-[#B87D2B] shrink-0" />
                      )}
                      {evt.type === 'question' && (
                        <MessageSquare className="w-4 h-4 text-[#83A58E] shrink-0" />
                      )}
                    </div>

                    <p className="text-[11px] text-[#556057] mt-1.5 leading-relaxed line-clamp-2">
                      {evt.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E4E9E3] text-[11px] text-[#768078]">
            Hệ thống tự động phát hiện 5 mốc quan trọng trong bài nói.
          </div>
        </div>
      </div>

      {/* Visual Analytics Graphs (Speech pace trend & Filler words) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Graph 1: Speech Pace Trend */}
        <div className="bg-white rounded-2xl border border-[#E4E9E3] p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E4E9E3]">
            <div>
              <h3 className="text-sm md:text-base font-bold text-[#3D4740] flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#83A58E]" />
                Biến thiên tốc độ nói theo thời gian
              </h3>
              <p className="text-xs text-[#768078] mt-0.5">
                Vùng lý tưởng cho thuyết trình học thuật: 120 – 140 từ/phút
              </p>
            </div>
            <span className="text-xs text-[#768078]">WPM</span>
          </div>

          {/* Bar Chart Visualization */}
          <div className="flex items-end justify-between h-44 pt-6 pb-2 px-2 gap-3 border-b border-[#E4E9E3]">
            {report.speechPaceTrend.map((item, idx) => {
              const isOver = item.wpm > 140;
              const heightPct = Math.min(100, (item.wpm / 160) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[11px] font-bold text-[#3D4740] tabular-nums">
                    {item.wpm}
                  </span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full max-w-[42px] rounded-t-md transition-all ${
                      isOver
                        ? 'bg-[#E5A96A] hover:bg-[#D99A57]'
                        : 'bg-[#83A58E] hover:bg-[#6F917A]'
                    }`}
                  />
                  <span className="text-[10px] text-[#768078]">{item.time}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-[#768078]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#83A58E]" />
              Khoảng nhịp nói chuẩn
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#E5A96A]" />
              Nói nhanh cần kiểm soát thở
            </span>
          </div>
        </div>

        {/* Graph 2: Filler Words Breakdown */}
        <div className="bg-white rounded-2xl border border-[#E4E9E3] p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E4E9E3]">
            <div>
              <h3 className="text-sm md:text-base font-bold text-[#3D4740] flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-[#83A58E]" />
                Phân tích tần suất từ đệm tiếng Việt
              </h3>
              <p className="text-xs text-[#768078] mt-0.5">
                Tổng cộng 7 lần xuất hiện từ thừa trong bài nói 12 phút
              </p>
            </div>
            <span className="text-xs font-semibold text-[#4A6453] bg-[#EEF4F0] px-2 py-0.5 rounded">
              Khá tốt
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {report.fillerWordBreakdown.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#3D4740]">"{item.word}"</span>
                  <span className="font-mono text-[#768078] tabular-nums">
                    {item.count} lần ({Math.round((item.count / 7) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#F2F5F2] rounded-full overflow-hidden">
                  <div
                    style={{ width: `${(item.count / 7) * 100}%` }}
                    className="h-full bg-[#83A58E] rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-[#FAFBF9] rounded-xl border border-[#E4E9E3] text-[11px] text-[#556057] mt-3">
            💡 <strong>Mẹo cải thiện:</strong> Khi cần suy nghĩ câu trả lời tiếp theo, bạn hãy giữ im lặng trong 1-2 giây thay vì phát âm "à thì" hoặc "ừm". Khoảng lặng sẽ giúp bạn trông điềm tĩnh và chuyên nghiệp hơn.
          </div>
        </div>
      </div>

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-white rounded-2xl border border-[#E4E9E3] p-5 md:p-6 shadow-xs space-y-3">
          <h3 className="text-sm md:text-base font-bold text-[#2A4433] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#5A7D65]" />
            Điểm mạnh nổi bật của bạn
          </h3>

          <ul className="space-y-2.5 text-xs text-[#444F47]">
            {report.strengths.map((s, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-[#5A7D65] font-bold">✓</span>
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Improvements */}
        <div className="bg-white rounded-2xl border border-[#E4E9E3] p-5 md:p-6 shadow-xs space-y-3">
          <h3 className="text-sm md:text-base font-bold text-[#3D4740] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#83A58E]" />
            Đề xuất để đạt điểm xuất sắc hơn
          </h3>

          <ul className="space-y-2.5 text-xs text-[#444F47]">
            {report.improvements.map((imp, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-[#83A58E] font-bold">→</span>
                <span className="leading-relaxed">{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Detailed Jury Feedback */}
      <div className="bg-white rounded-2xl border border-[#E4E9E3] p-5 md:p-6 shadow-xs space-y-4">
        <div className="pb-3 border-b border-[#E4E9E3]">
          <h3 className="text-base font-bold text-[#3D4740]">
            Nhận xét chi tiết từ Hội đồng Giám khảo mô phỏng
          </h3>
          <p className="text-xs text-[#768078] mt-0.5">
            Các ý kiến đánh giá trực tiếp về đề tài và năng lực thuyết trình
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {report.juryFeedback.map((j, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-[#FAFBF9] border border-[#E4E9E3] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#3D4740]">
                    {j.judgeName}
                  </span>
                  <span className="text-xs font-bold text-[#3D5C46] tabular-nums">
                    {j.score}/10
                  </span>
                </div>
                <p className="text-[11px] text-[#768078] mb-3">{j.judgeTitle}</p>
                <p className="text-xs text-[#556057] leading-relaxed italic">
                  "{j.comment}"
                </p>
              </div>

              <div className="mt-4 pt-2 border-t border-[#E4E9E3]/70 text-[10px] text-[#83A58E] font-semibold">
                Đánh giá theo chuẩn NCKH
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA to practice again */}
      <div className="p-6 bg-white rounded-2xl border border-[#E4E9E3] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-[#3D4740]">
            Bạn muốn cải thiện các điểm lưu ý trên?
          </h4>
          <p className="text-xs text-[#768078] mt-0.5">
            Hãy bắt đầu một buổi tập dượt mới để rèn luyện phản xạ ngôn ngữ.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
          onClick={onPracticeAgain}
        >
          Luyện tập lại ngay
        </Button>
      </div>
    </div>
  );
};
