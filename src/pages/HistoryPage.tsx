/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  History,
  Search,
  Filter,
  Calendar,
  Clock,
  Presentation,
  Award,
  ChevronRight,
  RotateCcw,
  FileCheck,
  CheckCircle2,
  Video,
  Trash2,
  Download,
  X
} from 'lucide-react';
import { PracticeSession, PracticeModeType, ActivePage } from '../types';
import { Button } from '../components/ui/Button';
import { DemoNotice } from '../components/ui/DemoNotice';
import { listLocalVideos, deleteLocalVideo, type LocalVideoRecord } from '../services/localVideoLibrary';
import { subscribeSession, refreshSession, type SessionState } from '../services/accountSession';

interface HistoryPageProps {
  sessions: PracticeSession[];
  onNavigate: (page: ActivePage) => void;
  onSelectSessionForReport: (sessionId: string) => void;
  onReplaySession: (session: PracticeSession) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  sessions,
  onNavigate,
  onSelectSessionForReport,
  onReplaySession,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | PracticeModeType>('all');
  // Temporary private-by-device video library. It does NOT sync to Google Drive.
  const [localVideos, setLocalVideos] = useState<LocalVideoRecord[]>([]);
  const [account, setAccount] = useState<SessionState>({ status: 'loading', identity: null });
  const [localError, setLocalError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<LocalVideoRecord | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeSession(next => {
      if (!mounted) return;
      setAccount(next);
      setPlaying(null);
      setLocalVideos([]);
      setLocalError(null);
      if (next.status === 'loading') return;
      if (next.status === 'unavailable') {
        // Keep guest/legacy recordings accessible when server session is not configured.
        // No signed-in video is displayed under an unverified identity.
        setLocalError('Dịch vụ đăng nhập chưa sẵn sàng. Chỉ hiển thị video chưa gắn tài khoản trên thiết bị.');
      }
      listLocalVideos(next.identity?.id || null)
        .then(items => { if (mounted) setLocalVideos(items); })
        .catch(error => { if (mounted) setLocalError(error instanceof Error ? error.message : 'Không tải được video đã lưu.'); });
    });
    void refreshSession();
    return () => { mounted = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!playing) {
      setPlaybackUrl(null);
      return;
    }
    const blobUrl = URL.createObjectURL(playing.blob);
    setPlaybackUrl(blobUrl);
    return () => URL.revokeObjectURL(blobUrl);
  }, [playing]);

  const downloadLocal = (item: LocalVideoRecord) => {
    const blobUrl = URL.createObjectURL(item.blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `SpeakLab_${item.sessionId}_${item.id}.${item.extension}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  };

  const removeLocal = async (item: LocalVideoRecord) => {
    if (!window.confirm('Xóa bản ghi này khỏi trình duyệt hiện tại? Hành động này không thể khôi phục. Video chưa được đồng bộ Google Drive.')) return;
    try {
      await deleteLocalVideo(item.id);
      setLocalVideos(prev => prev.filter(video => video.id !== item.id));
      if (playing?.id === item.id) setPlaying(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Không xóa được bản ghi.');
    }
  };

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.topic.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMode =
      selectedFilter === 'all' ? true : s.mode === selectedFilter;
    return matchesSearch && matchesMode;
  });

  return (
    <div className="space-y-6">
      <DemoNotice
        title="Lịch sử các buổi luyện tập"
        message="Danh sách các phiên luyện tập đã thực hiện. Bạn có thể xem lại báo cáo phân tích hoặc khởi chạy lại buổi luyện tập với các thông số tương tự."
      />

      {/* 3.2C-1: local recordings are NOT synchronized with Google Drive. */}
      <section className="bg-white border border-[#E4E9E3] rounded-2xl p-5 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-[#5A7D65]" />
            <h3 className="text-base font-bold text-[#3D4740]">Video đã ghi ({localVideos.length})</h3>
          </div>
          <span className="text-[11px] font-medium rounded-full border border-[#D9E5DC] bg-[#F7F9F6] text-[#47644F] px-3 py-1">
            Lưu tạm trên thiết bị · Chưa đồng bộ Drive
          </span>
        </div>
        <p className="text-xs text-[#768078]">
          Video lưu trên thiết bị này, chưa đồng bộ Google Drive. Danh sách đang được nhóm theo phiên Google
          trong trình duyệt, <strong>chưa phải phân quyền bảo mật</strong> (người dùng chung trình duyệt có thể
          truy cập dữ liệu cục bộ). Hãy dùng thiết bị riêng và tải video quan trọng về máy.
        </p>
        <div className="text-xs border border-[#D9E5DC] rounded-lg bg-[#F7F9F6] p-3 text-[#3D4740]">
          {account.status === 'signed_in'
            ? <>Đang xem video ghi trên thiết bị dưới tài khoản: <strong>{account.identity?.name || 'Google'}</strong>. Video cũ chưa gắn tài khoản sẽ nằm trong nhóm khách.</>
            : account.status === 'signed_out'
              ? <>Chế độ khách: chỉ hiện video cũ hoặc video ghi khi chưa đăng nhập. Đăng nhập tại <strong>Cài đặt</strong> để xem nhóm video của tài khoản.</>
              : account.status === 'loading'
                ? 'Đang kiểm tra phiên đăng nhập…'
                : 'Dịch vụ đăng nhập chưa sẵn sàng; chỉ hiển thị video khách/cũ, không hiển thị video gắn tài khoản.'}
        </div>
        {localError && (
          <p role="alert" className="text-xs border border-[#DFBAB8] bg-[#FFF4F3] text-[#873631] rounded-lg p-3">{localError}</p>
        )}
        {localVideos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D9E5DC] bg-[#F7F9F6] py-6 text-center text-xs text-[#768078]">
            Chưa có video lưu tạm. Hãy ghi PowerPoint trong phòng họp, sau đó nhấn Dừng ghi.
          </div>
        ) : (
          <div className="space-y-2">
            {localVideos.map(video => (
              <div key={video.id} className="flex flex-wrap items-center justify-between gap-3 border border-[#E4E9E3] rounded-xl p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 bg-[#EEF4F0] rounded-lg text-[#52785D]"><Video className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#3D4740] truncate">{video.title}</div>
                    <p className="text-[11px] text-[#768078]">
                      {new Date(video.createdAt).toLocaleString('vi-VN')} · {Math.max(0, Math.round(video.durationMs / 1000))} giây · {(video.sizeBytes / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center flex-wrap gap-2">
                  <button type="button" onClick={() => setPlaying(video)} className="text-xs font-semibold px-3 py-2 bg-[#83A58E] text-white hover:bg-[#6F917A] rounded-lg cursor-pointer">Xem lại</button>
                  <button type="button" onClick={() => downloadLocal(video)} className="text-xs px-3 py-2 border border-[#D9E5DC] rounded-lg text-[#3D4740] hover:bg-[#F7F9F6] flex items-center gap-1 cursor-pointer"><Download className="w-3.5 h-3.5" /> Tải về</button>
                  <button type="button" onClick={() => void removeLocal(video)} className="text-xs px-3 py-2 border border-[#EAD5D2] rounded-lg text-[#873631] hover:bg-[#FFF4F3] flex items-center gap-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Xóa cục bộ</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {playing && (
          <div className="border border-[#D9E5DC] bg-[#F7F9F6] rounded-xl p-3 space-y-3" role="region" aria-label="Xem lại video đã ghi">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-[#3D4740] truncate">{playing.title}</h4>
              <button type="button" className="p-2 hover:bg-[#E4E9E3] rounded-lg" aria-label="Đóng video" onClick={() => setPlaying(null)}><X className="w-4 h-4" /></button>
            </div>
            {playbackUrl && <video key={playing.id} controls playsInline preload="metadata" src={playbackUrl} className="w-full max-h-[60vh] bg-[#202923] rounded-xl" />}
          </div>
        )}
      </section>

      {/* Header and Filter Controls */}
      <div className="bg-white rounded-2xl border border-[#E4E9E3] p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base md:text-lg font-bold text-[#3D4740]">
              Tất cả các buổi luyện tập ({sessions.length})
            </h3>
            <p className="text-xs text-[#768078] mt-0.5">
              Theo dõi sự tiến bộ và điểm số qua từng lần tập dượt
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('practice_setup')}
          >
            + Buổi luyện mới
          </Button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#768078] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tên đề tài hoặc chủ đề..."
              className="w-full pl-9 pr-3.5 py-2 text-xs md:text-sm rounded-lg bg-white border border-[#E4E9E3] text-[#3D4740] focus:outline-none focus:ring-2 focus:ring-[#83A58E]"
            />
          </div>

          {/* Segmented Filter Buttons */}
          <div className="flex items-center gap-1 p-1 bg-[#F7F9F6] rounded-lg border border-[#E4E9E3] overflow-x-auto">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                selectedFilter === 'all'
                  ? 'bg-white text-[#324C3B] font-semibold shadow-2xs'
                  : 'text-[#768078] hover:text-[#3D4740]'
              }`}
            >
              Tất cả ({sessions.length})
            </button>
            <button
              onClick={() => setSelectedFilter('defense')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                selectedFilter === 'defense'
                  ? 'bg-white text-[#324C3B] font-semibold shadow-2xs'
                  : 'text-[#768078] hover:text-[#3D4740]'
              }`}
            >
              Hội đồng giám khảo
            </button>
            <button
              onClick={() => setSelectedFilter('basic')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                selectedFilter === 'basic'
                  ? 'bg-white text-[#324C3B] font-semibold shadow-2xs'
                  : 'text-[#768078] hover:text-[#3D4740]'
              }`}
            >
              Thuyết trình cơ bản
            </button>
            <button
              onClick={() => setSelectedFilter('debate')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                selectedFilter === 'debate'
                  ? 'bg-white text-[#324C3B] font-semibold shadow-2xs'
                  : 'text-[#768078] hover:text-[#3D4740]'
              }`}
            >
              Phản biện tình huống
            </button>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {filteredSessions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E4E9E3] p-12 text-center">
            <History className="w-10 h-10 text-[#768078] mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-[#3D4740]">
              Không tìm thấy buổi luyện tập phù hợp
            </p>
            <p className="text-xs text-[#768078] mt-1">
              Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc chế độ.
            </p>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              className="bg-white rounded-2xl border border-[#E4E9E3] p-5 shadow-xs hover:border-[#83A58E]/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm md:text-base font-bold text-[#3D4740]">
                    {session.title}
                  </h4>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#EEF4F0] text-[#324C3B] border border-[#D9E5DC]">
                    {session.modeTitle}
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#F7F9F6] text-[#768078] border border-[#E4E9E3]">
                    {session.topic}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-[#768078]">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#5A7D65]" />
                    <span>{session.createdAt}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#5A7D65]" />
                    <span>
                      {Math.floor(session.durationSeconds / 60)} phút{' '}
                      {session.durationSeconds % 60 > 0
                        ? `${session.durationSeconds % 60}s`
                        : ''}
                    </span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{session.slideCount} slides</span>
                  <span aria-hidden="true">·</span>
                  <span>{session.participantCount} người tham dự</span>
                </div>
              </div>

              {/* Score & Actions */}
              <div className="flex items-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-[#E4E9E3] self-end md:self-auto">
                {session.score && (
                  <div className="text-right pr-2">
                    <span className="text-base font-bold text-[#3D5C46] tabular-nums">
                      {session.score.toFixed(1)}/10
                    </span>
                    <p className="text-[10px] text-[#768078]">Điểm demo (Minh họa)</p>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={() => onReplaySession(session)}
                  title="Luyện lại bài này"
                >
                  Luyện lại
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  icon={<FileCheck className="w-3.5 h-3.5" />}
                  onClick={() => {
                    onSelectSessionForReport(session.id);
                    onNavigate('report');
                  }}
                >
                  Xem báo cáo
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
