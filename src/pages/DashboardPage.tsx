/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Sparkles,
  PlayCircle,
  Clock,
  Award,
  FileCheck,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  Mic,
  Camera,
  Layers,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { UserProfile, PracticeSession, ActivePage } from '../types';
import { Button } from '../components/ui/Button';
import { DemoNotice } from '../components/ui/DemoNotice';

interface DashboardPageProps {
  currentUser: UserProfile;
  recentSessions: PracticeSession[];
  onNavigate: (page: ActivePage) => void;
  onSelectSessionForReport: (sessionId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  currentUser,
  recentSessions,
  onNavigate,
  onSelectSessionForReport,
}) => {
  return (
    <div className="space-y-6">
      {/* Demo Notice Banner */}
      <DemoNotice />

      {/* Hero Welcome Card */}
      <div className="relative bg-white rounded-2xl border border-[#E4E9E3] p-6 md:p-8 shadow-xs overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-md bg-[#EEF4F0] text-[#324C3B] border border-[#D9E5DC]">
            <Sparkles className="w-3.5 h-3.5 text-[#5A7D65]" />
            <span>Phòng Thuyết Trình Trực Tuyến Giả Lập</span>
          </div>

          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-[#3D4740] tracking-tight text-balance">
            Chào {currentUser.fullName.split(' ').pop()}! Sẵn sàng rèn luyện bản lĩnh thuyết trình hôm nay chưa?
          </h2>

          <p className="text-sm md:text-base text-[#768078] leading-relaxed">
            Luyện tập tự tin trước hội đồng giám khảo và thính giả mô phỏng. Trải nghiệm không gian phòng họp trực tuyến như Google Meet/Zoom để nâng cao phản xạ thuyết trình và bảo vệ đề tài.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              icon={<PlayCircle className="w-5 h-5" />}
              onClick={() => onNavigate('practice_setup')}
            >
              Bắt đầu luyện tập
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => onNavigate('history')}
            >
              Xem lịch sử buổi tập
            </Button>
          </div>
        </div>

        {/* Decorative backdrop illustration element in Sage Green */}
        <div className="absolute -right-8 -bottom-10 w-72 h-72 rounded-full bg-[#EEF4F0]/60 pointer-events-none -z-0 blur-2xl" />
      </div>

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Stat 1 */}
        <div className="bg-white rounded-xl border border-[#E4E9E3] p-4 md:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#768078]">Số buổi luyện tập</span>
            <div className="w-8 h-8 rounded-lg bg-[#EEF4F0] flex items-center justify-center text-[#3D5C46]">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
            <span className="text-2xl md:text-3xl font-bold text-[#3D4740] tabular-nums">
              {currentUser.stats.totalSessions}
            </span>
            <span className="text-xs text-[#768078]">buổi hoàn thành</span>
          </div>
          <p className="text-[11px] text-[#5A7D65] mt-1 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3 h-3 shrink-0" />
            <span>Chỉ tính buổi đã hoàn thành trên thiết bị</span>
          </p>
        </div>

        {/* Stat 2 */}
        <div className="bg-white rounded-xl border border-[#E4E9E3] p-4 md:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#768078]">Tổng thời gian luyện</span>
            <div className="w-8 h-8 rounded-lg bg-[#EEF4F0] flex items-center justify-center text-[#3D5C46]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
            <span className="text-2xl md:text-3xl font-bold text-[#3D4740] tabular-nums">
              {(currentUser.stats.totalPracticeMinutes / 60).toFixed(1)}
            </span>
            <span className="text-xs text-[#768078]">giờ tích lũy</span>
          </div>
          <p className="text-[11px] text-[#768078] mt-1">
            Trung bình {currentUser.stats.avgMinutesPerSession} phút / buổi
          </p>
        </div>

        {/* Stat 3 */}
        <div className="bg-white rounded-xl border border-[#E4E9E3] p-4 md:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#768078]">Báo cáo đánh giá</span>
            <div className="w-8 h-8 rounded-lg bg-[#EEF4F0] flex items-center justify-center text-[#3D5C46]">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
            <span className="text-2xl md:text-3xl font-bold text-[#3D4740] tabular-nums">
              {currentUser.stats.totalReports}
            </span>
            <span className="text-xs text-[#768078]">bản phân tích</span>
          </div>
          <p className="text-[11px] text-[#5A7D65] mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>Chưa có báo cáo đánh giá tự động từ dữ liệu thực</span>
          </p>
        </div>

        {/* Stat 4 */}
        <div className="bg-white rounded-xl border border-[#E4E9E3] p-4 md:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#768078]">Mức độ tiến bộ</span>
            <div className="w-8 h-8 rounded-lg bg-[#EEF4F0] flex items-center justify-center text-[#3D5C46]">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
            <span className="text-2xl md:text-3xl font-bold text-[#3D5C46] tabular-nums">
              —
            </span>
            <span className="text-xs text-[#768078]">chưa đo lường</span>
          </div>
          <p className="text-[11px] text-[#768078] mt-1">
            Chỉ hiển thị khi có phương pháp đánh giá thực tế
          </p>
        </div>
      </div>

      {/* Main Grid: Recent Sessions & Quick Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Practice Sessions */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E4E9E3] p-5 md:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#E4E9E3]">
              <div>
                <h3 className="text-base font-bold text-[#3D4740]">
                  Các buổi luyện tập gần đây
                </h3>
                <p className="text-xs text-[#768078] mt-0.5">
                  Những buổi thực sự hoàn thành trên thiết bị này
                </p>
              </div>

              <button
                onClick={() => onNavigate('history')}
                className="text-xs font-semibold text-[#4A6453] hover:text-[#2A4433] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Xem tất cả</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-[#E4E9E3]/70">
              {recentSessions.length === 0 && (
                <p className="py-7 text-xs text-[#768078]">Chưa có buổi luyện hoàn thành. Hãy bắt đầu luyện và nhấn Kết thúc để lưu lịch sử.</p>
              )}
              {recentSessions.slice(0, 3).map((session) => (
                <div
                  key={session.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-[#F7F9F6] px-2 -mx-2 rounded-xl transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#3D4740] group-hover:text-[#2A4433] transition-colors">
                        {session.title}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-[#EEF4F0] text-[#324C3B] border border-[#D9E5DC]">
                        {session.modeTitle}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#768078]">
                      <span>{session.createdAt}</span>
                      <span aria-hidden="true">·</span>
                      <span>{Math.floor(session.durationSeconds / 60)} phút</span>
                      <span aria-hidden="true">·</span>
                      <span>{session.slideCount} slides</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    {session.score && (
                      <div className="text-right">
                        <span className="text-xs font-bold text-[#3D5C46] tabular-nums">
                          {session.score.toFixed(1)}/10
                        </span>
                        <p className="text-[10px] text-[#768078]">Điểm demo (Minh họa)</p>
                      </div>
                    )}

                    {session.reportId ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          onSelectSessionForReport(session.id);
                          onNavigate('report');
                        }}
                      >
                        Xem báo cáo
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => onNavigate('history')}>
                        Xem lịch sử
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E4E9E3] flex items-center justify-between text-xs text-[#768078]">
            <span>Đang xem {Math.min(3, recentSessions.length)} / {recentSessions.length} buổi hoàn thành</span>
            <button
              onClick={() => onNavigate('practice_setup')}
              className="text-xs font-medium text-[#4A6453] hover:underline"
            >
              + Tạo buổi luyện mới
            </button>
          </div>
        </div>

        {/* Right Column: 3-Step Quick Guide */}
        <div className="bg-white rounded-2xl border border-[#E4E9E3] p-5 md:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-[#3D4740]">
              Hướng dẫn 3 bước bắt đầu
            </h3>
            <p className="text-xs text-[#768078] mt-0.5">
              Quy trình làm quen với phòng họp trực tuyến mô phỏng
            </p>

            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#EEF4F0] text-[#324C3B] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-[#D9E5DC]">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#3D4740]">
                    Chọn chủ đề & Chế độ luyện
                  </h4>
                  <p className="text-[11px] text-[#768078] mt-0.5 leading-relaxed">
                    Chọn giữa Thuyết trình tự do, Hội đồng bảo vệ hoặc Phản biện tình huống.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#EEF4F0] text-[#324C3B] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-[#D9E5DC]">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#3D4740]">
                    Vào phòng họp mô phỏng
                  </h4>
                  <p className="text-[11px] text-[#768078] mt-0.5 leading-relaxed">
                    Quan sát phản ứng của giám khảo và khán giả mô phỏng trong khi trình chiếu slide.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#EEF4F0] text-[#324C3B] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-[#D9E5DC]">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#3D4740]">
                    Nhận báo cáo phân tích
                  </h4>
                  <p className="text-[11px] text-[#768078] mt-0.5 leading-relaxed">
                    Xem lại biểu đồ nhịp độ nói, các điểm cần cải thiện và góp ý từ hội đồng.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#E4E9E3]">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => onNavigate('practice_setup')}
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
            >
              Vào phòng chuẩn bị
            </Button>
          </div>
        </div>
      </div>

      {/* Roadmap / Future Capabilities Section (as specifically requested in prompt) */}
      <div className="bg-[#FAFBF9] rounded-2xl border border-[#E4E9E3] p-5 md:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E4E9E3]">
          <div>
            <h3 className="text-sm md:text-base font-bold text-[#3D4740] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#83A58E]" />
              Lộ trình tính năng nâng cao (Đợt 2 & 3)
            </h3>
            <p className="text-xs text-[#768078] mt-0.5">
              Các module AI và xử lý đa phương tiện sẽ được tích hợp trong giai đoạn sau
            </p>
          </div>
          <span className="text-[11px] text-[#556057] bg-white px-2.5 py-1 rounded-md border border-[#E4E9E3] self-start sm:self-auto font-medium">
            Kế hoạch nghiên cứu & phát triển
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div className="bg-white p-4 rounded-xl border border-[#E4E9E3]">
            <div className="w-8 h-8 rounded-lg bg-[#EEF4F0] text-[#3D5C46] flex items-center justify-center mb-2">
              <Camera className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-[#3D4740]">
              Thị giác máy tính & Cử chỉ
            </h4>
            <p className="text-[11px] text-[#768078] mt-1 leading-relaxed">
              Nhận diện hướng nhìn (Eye-contact), tần suất chớp mắt, cử chỉ tay mở và tư thế đứng trước máy quay.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E4E9E3]">
            <div className="w-8 h-8 rounded-lg bg-[#EEF4F0] text-[#3D5C46] flex items-center justify-center mb-2">
              <Mic className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-[#3D4740]">
              Phân tích Giọng nói Tiếng Việt
            </h4>
            <p className="text-[11px] text-[#768078] mt-1 leading-relaxed">
              Đo tốc độ nói (từ/phút), phát hiện khoảng lặng ngập ngừng, đếm từ đệm "à, ừm, thì là" theo thời gian thực.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E4E9E3]">
            <div className="w-8 h-8 rounded-lg bg-[#EEF4F0] text-[#3D5C46] flex items-center justify-center mb-2">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-[#3D4740]">
              Hội đồng AI Phản biện
            </h4>
            <p className="text-[11px] text-[#768078] mt-1 leading-relaxed">
              Trích xuất nội dung từ từng slide PowerPoint để tạo các câu hỏi chất vấn hóc búa, đánh giá độ logic phản hồi.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E4E9E3]">
            <div className="w-8 h-8 rounded-lg bg-[#EEF4F0] text-[#3D5C46] flex items-center justify-center mb-2">
              <FileCheck className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-[#3D4740]">
              Minh chứng Video đa nền tảng
            </h4>
            <p className="text-[11px] text-[#768078] mt-1 leading-relaxed">
              Phát lại video kèm nhãn mốc thời gian vi phạm hoặc xuất sắc; tối ưu xuất ứng dụng di động iOS/Android qua Capacitor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
