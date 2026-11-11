/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, FileText, Lightbulb, Clock, Check } from 'lucide-react';
import { PresentationSlide } from '../../types';

interface PresenterNotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  slide?: PresentationSlide;
  currentSlideIndex: number;
  totalSlides: number;
  customTitle?: string;
  customNotes?: string;
}

export const PresenterNotesDrawer: React.FC<PresenterNotesDrawerProps> = ({
  isOpen,
  onClose,
  slide,
  currentSlideIndex,
  totalSlides,
  customTitle,
  customNotes,
}) => {
  if (!isOpen) return null;

  const displayTitle = customTitle || slide?.title || `Slide ${currentSlideIndex + 1}`;
  const displayNotes = customNotes !== undefined ? customNotes : (slide?.speakerNotes || 'Không có ghi chú riêng cho slide này.');

  return (
    <div className="absolute inset-y-0 right-0 lg:relative w-80 md:w-96 max-w-[90vw] bg-[#1F2621] border-l border-[#2E3A31] flex flex-col h-full shadow-2xl z-40 lg:z-20 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 px-4 border-b border-[#2E3A31] flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#83A58E]" />
          <span className="text-sm font-bold">Kịch bản thuyết trình</span>
          <span className="text-xs text-[#A8B6AB]">
            (Slide {currentSlideIndex + 1}/{totalSlides})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-[#A8B6AB] hover:text-white hover:bg-[#2B382F]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Slide Title preview */}
        <div className="p-3 rounded-xl bg-[#263129] border border-[#334237]">
          <span className="text-[10px] text-[#83A58E] font-semibold uppercase tracking-wider">
            Tiêu đề Slide hiện tại
          </span>
          <h4 className="text-sm font-bold text-white mt-1 break-all">{displayTitle}</h4>
        </div>

        {/* Speaker Notes */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#D4E0D7] flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#83A58E]" />
            <span>Lời thoại gợi ý cho học sinh:</span>
          </label>
          <div className="p-3.5 rounded-xl bg-[#18201A] border border-[#2B382F] text-[#D8E6DC] leading-relaxed text-xs whitespace-pre-wrap">
            {displayNotes}
          </div>
        </div>

        {/* Presentation Tips */}
        <div className="p-3 rounded-xl bg-[#253027] border border-[#37473A] space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#83A58E]">
            <Lightbulb className="w-4 h-4" />
            <span>Mẹo rèn luyện phong thái</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-[#A8B6AB]">
            <li className="flex items-start gap-1.5">
              <span className="text-[#83A58E] font-bold">·</span>
              <span>Giữ nhịp thở đều, dừng khoảng 1 giây sau mỗi số liệu chính.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-[#83A58E] font-bold">·</span>
              <span>Hướng mắt nhìn luân phiên giữa các ô giám khảo trên màn hình.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-[#83A58E] font-bold">·</span>
              <span>Tránh dùng từ đệm "ừm, thì là" khi chuẩn bị chuyển ý.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
