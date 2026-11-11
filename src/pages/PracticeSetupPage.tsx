/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Presentation,
  Shield,
  MessageSquare,
  Users,
  Clock,
  FileText,
  Upload,
  ArrowRight,
  Sparkles,
  Info,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  PracticeModeType,
  PracticeMode,
  PresentationDeck,
  PracticeSetupConfig,
  PresentationSource
} from '../types';
import { Button } from '../components/ui/Button';
import { DemoNotice } from '../components/ui/DemoNotice';
import { PptxUploader } from '../features/presentation/PptxUploader';
import { pptxSessionStore } from '../services/pptxService';

interface PracticeSetupPageProps {
  availableModes: PracticeMode[];
  availableDecks: PresentationDeck[];
  initialConfig?: PracticeSetupConfig;
  onConfigChange?: (config: PracticeSetupConfig) => void;
  onStartSession: (config: PracticeSetupConfig) => void;
  onCancel: () => void;
}

export const PracticeSetupPage: React.FC<PracticeSetupPageProps> = ({
  availableModes,
  availableDecks,
  initialConfig,
  onConfigChange,
  onStartSession,
  onCancel,
}) => {
  const [selectedModeId, setSelectedModeId] = useState<PracticeModeType>(
    initialConfig?.modeId || 'defense'
  );
  const [sessionTitle, setSessionTitle] = useState(
    initialConfig?.title || 'Bảo vệ Đề tài: Phân loại Rác Thông minh bằng AI'
  );
  const [selectedDeckId, setSelectedDeckId] = useState<string>(
    initialConfig?.deckId || availableDecks[0]?.id || ''
  );
  const [participantCount, setParticipantCount] = useState<number>(
    initialConfig?.participantCount || 6
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(
    initialConfig?.durationMinutes || 12
  );
  const [expandedMobileModeId, setExpandedMobileModeId] = useState<PracticeModeType | null>(null);

  // Active Presentation Source: Demo vs PPTX
  const [presentationSource, setPresentationSource] = useState<PresentationSource>(() => {
    if (initialConfig?.presentationSource) {
      return initialConfig.presentationSource;
    }
    const storedPptx = pptxSessionStore.getPptx();
    if (storedPptx) {
      return {
        type: 'pptx',
        pptxInfo: storedPptx,
        name: storedPptx.name,
        slideCount: storedPptx.slideCount,
        status: 'ready',
      };
    }
    const defaultDeck = availableDecks[0];
    return {
      type: 'demo',
      deckId: defaultDeck?.id || 'deck_ai_waste',
      name: defaultDeck?.title || 'Slide mẫu',
      slideCount: defaultDeck?.slides.length || 6,
      status: 'ready',
    };
  });

  // Sync back to parent whenever config changes so returning to this page retains choices
  useEffect(() => {
    if (onConfigChange) {
      onConfigChange({
        title: sessionTitle,
        modeId: selectedModeId,
        deckId: selectedDeckId,
        participantCount,
        durationMinutes,
        presentationSource,
      });
    }
  }, [sessionTitle, selectedModeId, selectedDeckId, participantCount, durationMinutes, presentationSource, onConfigChange]);

  const selectedMode =
    availableModes.find((m) => m.id === selectedModeId) || availableModes[0];
  const selectedDeck =
    availableDecks.find((d) => d.id === selectedDeckId) || availableDecks[0];

  const handleSelectDemoDeck = (deck: PresentationDeck) => {
    setSelectedDeckId(deck.id);
    const newSource: PresentationSource = {
      type: 'demo',
      deckId: deck.id,
      name: deck.title,
      slideCount: deck.slides.length,
      status: 'ready',
    };
    setPresentationSource(newSource);
    pptxSessionStore.setDemoSource(deck.id, deck.title, deck.slides.length);
  };

  const handlePptxSourceChange = (newSource: PresentationSource) => {
    setPresentationSource(newSource);
    // If current title is default, suggest clean title from PPTX filename
    if (sessionTitle === 'Bảo vệ Đề tài: Phân loại Rác Thông minh bằng AI') {
      const cleanName = newSource.name.replace(/\.pptx$/i, '').replace(/[_-]/g, ' ');
      setSessionTitle(`Thuyết trình: ${cleanName}`);
    }
  };

  const handleStart = () => {
    onStartSession({
      title: sessionTitle.trim() || `Buổi luyện: ${selectedMode.title}`,
      modeId: selectedModeId,
      deckId: selectedDeckId,
      participantCount,
      durationMinutes,
      presentationSource,
    });
  };

  const getModeIcon = (modeId: PracticeModeType) => {
    switch (modeId) {
      case 'basic':
        return <Presentation className="w-5 h-5 text-[#4A6954]" />;
      case 'defense':
        return <Shield className="w-5 h-5 text-[#324C3B]" />;
      case 'debate':
        return <MessageSquare className="w-5 h-5 text-[#5A7D65]" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Banner */}
      <DemoNotice
        title="Thiết lập phòng luyện tập mô phỏng"
        message="Trong Đợt 1, các thông số phòng họp và hội đồng được mô phỏng trực quan để bạn làm quen với trải nghiệm trước khi kết nối hệ thống phân tích AI."
      />

      <div className="bg-white rounded-2xl border border-[#E4E9E3] p-5 md:p-8 shadow-xs space-y-8">
        {/* Section 1: Choose Practice Mode */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base md:text-lg font-bold text-[#3D4740]">
                1. Chọn chế độ luyện tập
              </h3>
              <p className="text-xs text-[#768078] mt-0.5">
                Mỗi chế độ có kịch bản hội đồng và mức độ phản biện khác nhau
              </p>
            </div>
            <span className="text-xs font-semibold text-[#4A6453] bg-[#EEF4F0] px-2.5 py-1 rounded-md border border-[#D9E5DC]">
              3 chế độ dự kiến
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {availableModes.map((mode) => {
              const isSelected = selectedModeId === mode.id;
              const isMobileExpanded = expandedMobileModeId === mode.id;

              return (
                <div
                  key={mode.id}
                  onClick={() => {
                    setSelectedModeId(mode.id);
                    setDurationMinutes(mode.defaultDurationMinutes);
                  }}
                  className={`relative p-4 md:p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#F2F6F3] border-[#83A58E] shadow-sm ring-1 ring-[#83A58E]'
                      : 'bg-white border-[#E4E9E3] hover:border-[#83A58E]/60 hover:bg-[#F7F9F6]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                      <div className="w-9 h-9 rounded-lg bg-white border border-[#E4E9E3] flex items-center justify-center shadow-2xs">
                        {getModeIcon(mode.id)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white border border-[#E4E9E3] text-[#556057]">
                          {mode.difficulty}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-[#83A58E]" />
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-[#3D4740]">
                      {mode.title}
                    </h4>
                    <p className="text-xs text-[#768078] mt-1 leading-relaxed">
                      {mode.tagline}
                    </p>

                    {/* Features list: always shown on desktop, toggleable on mobile */}
                    <div className={`${isMobileExpanded ? 'block' : 'hidden md:block'} mt-3.5 space-y-1.5 text-[11px] text-[#556057]`}>
                      {mode.highlightFeatures.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#5A7D65] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>

                    {/* Mobile toggle to expand/collapse details */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedMobileModeId(isMobileExpanded ? null : mode.id);
                      }}
                      className="md:hidden mt-2 text-[11px] font-semibold text-[#4A6453] flex items-center gap-1"
                    >
                      <span>{isMobileExpanded ? 'Thu gọn chi tiết' : 'Xem chi tiết tiêu chí'}</span>
                      {isMobileExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E4E9E3]/70 flex items-center justify-between text-[11px] text-[#768078]">
                    <span>
                      Gợi ý: {mode.juryCount} giám khảo · {mode.audienceCount} thính giả
                    </span>
                    <span className="font-medium text-[#3D4740]">
                      ~{mode.defaultDurationMinutes} phút
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Session Name & Parameters */}
        <div className="pt-6 border-t border-[#E4E9E3]">
          <h3 className="text-base md:text-lg font-bold text-[#3D4740] mb-4">
            2. Thông tin buổi thuyết trình
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#3D4740] mb-1.5">
                Tên buổi luyện / Đề tài
              </label>
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="Ví dụ: Thuyết trình Dự án Nghiên cứu Khoa học 2026..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-[#E4E9E3] text-sm text-[#3D4740] focus:outline-none focus:ring-2 focus:ring-[#83A58E] focus:border-transparent transition-all shadow-2xs"
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] text-[#768078]">Gợi ý nhanh:</span>
                {[
                  'Bảo vệ Đề tài: AI Phân loại Rác Học đường',
                  'Kế hoạch Khởi nghiệp Xanh: Bao bì EcoHusk',
                  'Bài nói Kỹ năng Tranh biện Tự do',
                ].map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSessionTitle(sug)}
                    className="text-[11px] px-2 py-0.5 rounded bg-[#F7F9F6] text-[#556057] hover:bg-[#EEF4F0] hover:text-[#324C3B] border border-[#E4E9E3] transition-colors cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Target Duration */}
              <div>
                <label className="block text-xs font-semibold text-[#3D4740] mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#5A7D65]" />
                    <span>Thời lượng mục tiêu</span>
                  </span>
                  <span className="text-[11px] font-bold text-[#3D5C46]">{durationMinutes} phút</span>
                </label>
                <div className="flex items-center gap-2">
                  {[5, 10, 12, 15, 20].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDurationMinutes(mins)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                        durationMinutes === mins
                          ? 'bg-[#EEF4F0] text-[#324C3B] border-[#83A58E] font-semibold ring-1 ring-[#83A58E]'
                          : 'bg-white text-[#556057] border-[#E4E9E3] hover:bg-[#F7F9F6]'
                      }`}
                    >
                      {mins}p
                    </button>
                  ))}
                </div>
              </div>

              {/* Participant Count */}
              <div>
                <label className="block text-xs font-semibold text-[#3D4740] mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#5A7D65]" />
                    <span>Quy mô thính giả mô phỏng (Không gồm bạn)</span>
                  </span>
                  <span className="text-[11px] font-bold text-[#3D5C46]">{participantCount} người</span>
                </label>
                <div className="flex items-center gap-2">
                  {[3, 6, 10, 15].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setParticipantCount(cnt)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                        participantCount === cnt
                          ? 'bg-[#EEF4F0] text-[#324C3B] border-[#83A58E] font-semibold ring-1 ring-[#83A58E]'
                          : 'bg-white text-[#556057] border-[#E4E9E3] hover:bg-[#F7F9F6]'
                      }`}
                    >
                      {cnt} người
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#768078] italic pt-1">
              * Hệ thống sẽ khởi tạo chính xác {participantCount} người tham dự (phân bổ hội đồng giám khảo và thính giả theo chế độ) khi bạn vào phòng.
            </p>
          </div>
        </div>

        {/* Section 3: Presentation Deck Preparation */}
        <div className="pt-6 border-t border-[#E4E9E3] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base md:text-lg font-bold text-[#3D4740]">
                3. Tài liệu trình chiếu
              </h3>
              <p className="text-xs text-[#768078] mt-0.5">
                Chọn bộ slide mẫu hoặc tải lên tệp PowerPoint (.pptx) cá nhân từ thiết bị của bạn
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
                presentationSource.type === 'pptx'
                  ? 'text-[#2A4433] bg-[#EEF4F0] border-[#83A58E]'
                  : 'text-[#4A6453] bg-[#EEF4F0] border-[#D9E5DC]'
              }`}>
                {presentationSource.type === 'pptx'
                  ? `Đang chọn: PowerPoint cá nhân (${presentationSource.slideCount} slides)`
                  : `Đang chọn: Slide mẫu (${selectedDeck.slides.length} slides)`}
              </span>
            </div>
          </div>

          {/* Sub-section A: Available Demo Decks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#3D4740] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#83A58E]" />
                Nguồn 1: Các bộ slide mẫu có sẵn
              </span>
              <span className="text-[11px] text-[#768078]">
                {availableDecks.length} bộ đề tài
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {availableDecks.map((deck) => {
                const isDeckSelected = presentationSource.type === 'demo' && selectedDeckId === deck.id;
                return (
                  <div
                    key={deck.id}
                    onClick={() => handleSelectDemoDeck(deck)}
                    className={`p-3.5 md:p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isDeckSelected
                        ? 'bg-[#EEF4F0] border-[#83A58E] ring-1 ring-[#83A58E] shadow-2xs'
                        : 'bg-white border-[#E4E9E3] hover:bg-[#F7F9F6] hover:border-[#83A58E]/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold text-[#4A6453] bg-white px-2 py-0.5 rounded border border-[#D9E5DC]">
                          {deck.category}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[#768078]">
                            {deck.slides.length} slides
                          </span>
                          {isDeckSelected && (
                            <span className="w-2 h-2 rounded-full bg-[#83A58E]" />
                          )}
                        </div>
                      </div>
                      <h4 className="text-sm font-bold text-[#3D4740]">
                        {deck.title}
                      </h4>
                      <p className="text-xs text-[#768078] mt-1 leading-relaxed line-clamp-2">
                        {deck.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#E4E9E3]/70 flex items-center justify-between text-[11px] text-[#768078]">
                      <span>{deck.slides[0]?.title}</span>
                      <span className="font-medium text-[#4A6453]">
                        {isDeckSelected ? 'Đang chọn' : 'Bấm để chọn'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-section B: Real PowerPoint Upload (Phase 2.1) */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#3D4740] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#83A58E]" />
                Nguồn 2: Tải lên tệp PowerPoint (.pptx) cá nhân
              </span>
              <span className="text-[11px] font-semibold text-[#4A6453] bg-[#EEF4F0] px-2 py-0.5 rounded border border-[#D9E5DC]">
                Đợt 2.1 Mới
              </span>
            </div>

            <PptxUploader
              currentSource={presentationSource}
              onSourceChange={handlePptxSourceChange}
              onDeckSelectRequested={() => handleSelectDemoDeck(selectedDeck)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-6 border-t border-[#E4E9E3] flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Quay lại Tổng quan
          </Button>

          <Button
            variant="primary"
            size="lg"
            icon={<ArrowRight className="w-5 h-5" />}
            iconPosition="right"
            onClick={handleStart}
            className="w-full sm:w-auto px-8"
          >
            Vào phòng luyện tập
          </Button>
        </div>
      </div>
    </div>
  );
};
