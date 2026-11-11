/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Upload,
  FileCheck,
  AlertCircle,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { PptxDocumentInfo, PresentationSource } from '../../types';
import {
  validateAndParsePptx,
  MAX_PPTX_SIZE_MB,
  pptxSessionStore
} from '../../services/pptxService';
import { Button } from '../../components/ui/Button';

interface PptxUploaderProps {
  currentSource: PresentationSource;
  onSourceChange: (source: PresentationSource) => void;
  onDeckSelectRequested: () => void;
}

export const PptxUploader: React.FC<PptxUploaderProps> = ({
  currentSource,
  onSourceChange,
  onDeckSelectRequested,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPptxActive = currentSource.type === 'pptx' && !!currentSource.pptxInfo;
  const currentPptx = currentSource.pptxInfo || pptxSessionStore.getPptx();

  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);
    setIsValidating(true);

    try {
      // Validate Open XML, format, size and extract accurate slide count
      const docInfo = await validateAndParsePptx(file);

      // Save into session memory store
      pptxSessionStore.setPptx(docInfo);

      // Update current presentation source to PPTX
      onSourceChange({
        type: 'pptx',
        pptxInfo: docInfo,
        name: docInfo.name,
        slideCount: docInfo.slideCount,
        status: 'ready',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi không xác định xảy ra khi đọc tệp.';
      setErrorMessage(msg);
    } finally {
      setIsValidating(false);
      // Reset input value so re-selecting same file works
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleTriggerPicker = () => {
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRemovePptx = (e: React.MouseEvent) => {
    e.stopPropagation();
    pptxSessionStore.clearPptx();
    setErrorMessage(null);
    onDeckSelectRequested();
  };

  const handleSelectPptxSource = () => {
    if (currentPptx) {
      onSourceChange({
        type: 'pptx',
        pptxInfo: currentPptx,
        name: currentPptx.name,
        slideCount: currentPptx.slideCount,
        status: 'ready',
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Validation Error Message */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-[#FDF3F3] border border-[#F2C0BD] text-xs text-[#873631] flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-[#C93B32] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-[#873631]">Tệp không được chấp nhận</p>
            <p className="mt-0.5 leading-relaxed text-[#6E2B27]">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-[11px] underline text-[#873631] hover:text-[#521C19] shrink-0 cursor-pointer ml-1"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Validating Spinner Overlay State */}
      {isValidating && (
        <div className="p-6 rounded-xl border border-[#D9E5DC] bg-[#FAFBF9] text-center space-y-2">
          <div className="w-9 h-9 mx-auto border-3 border-[#83A58E] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#3D4740]">
            Đang kiểm tra tệp PowerPoint...
          </p>
          <p className="text-[11px] text-[#768078]">
            Đọc cấu trúc Open XML và đếm chính xác số slide
          </p>
        </div>
      )}

      {/* CASE 1: Valid PPTX already loaded */}
      {!isValidating && currentPptx ? (
        <div
          onClick={handleSelectPptxSource}
          className={`p-4 md:p-5 rounded-xl border transition-all cursor-pointer ${
            isPptxActive
              ? 'bg-[#EEF4F0] border-[#83A58E] ring-2 ring-[#83A58E] shadow-sm'
              : 'bg-white border-[#E4E9E3] hover:border-[#83A58E]/70 hover:bg-[#FAFBF9]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white border border-[#D9E5DC] flex items-center justify-center shrink-0 shadow-2xs">
                <FileCheck className="w-5 h-5 text-[#4A6453]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold text-[#324C3B] bg-white px-2 py-0.5 rounded border border-[#D9E5DC]">
                    PowerPoint (.pptx)
                  </span>
                  {isPptxActive ? (
                    <span className="text-[10px] font-semibold text-white bg-[#4A6453] px-2 py-0.5 rounded">
                      Đang chọn nguồn này
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#768078] bg-[#F7F9F6] px-1.5 py-0.5 rounded">
                      Bấm để chọn tệp này
                    </span>
                  )}
                </div>

                <h4
                  className="text-sm font-bold text-[#3D4740] break-all leading-snug"
                  title={currentPptx.name}
                >
                  {currentPptx.name}
                </h4>

                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-[#556057]">
                  <span>Dung lượng: <strong>{currentPptx.sizeFormatted}</strong></span>
                  <span>·</span>
                  <span className="font-semibold text-[#2A4433] flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-[#5A7D65]" />
                    {currentPptx.slideCount} slides
                  </span>
                  <span>·</span>
                  <span className="text-[11px] text-[#768078]">Đọc lúc {currentPptx.parsedAt}</span>
                </div>
              </div>
            </div>

            {/* Action buttons on document card */}
            <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#D9E5DC]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTriggerPicker();
                }}
                className="px-3 py-1.5 text-xs rounded-lg bg-white hover:bg-[#F2F6F3] text-[#3D4740] border border-[#D9E5DC] flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
                title="Chọn một tệp PowerPoint khác từ thiết bị"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#556057]" />
                <span>Thay đổi tệp</span>
              </button>

              <button
                type="button"
                onClick={handleRemovePptx}
                className="px-3 py-1.5 text-xs rounded-lg bg-white hover:bg-[#FDF3F3] text-[#873631] border border-[#F2C0BD] flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
                title="Xóa tài liệu PPTX và quay lại dùng slide mẫu"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#C93B32]" />
                <span>Xóa tài liệu</span>
              </button>
            </div>
          </div>

          {/* Validation Status Badge */}
          <div className="mt-3 pt-2.5 border-t border-[#D9E5DC]/80 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-[#324C3B] font-medium text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#5A7D65]" />
              Đã kiểm tra tệp thành công (Cấu trúc Open XML hợp lệ)
            </span>

            <span className="text-[10px] text-[#768078] hidden sm:inline">
              Lưu trữ an toàn trong phiên làm việc
            </span>
          </div>
        </div>
      ) : !isValidating ? (
        /* CASE 2: No valid PPTX yet, show Dropzone / Upload area */
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleTriggerPicker}
          className={`border-2 border-dashed rounded-xl p-5 md:p-7 text-center transition-all cursor-pointer group ${
            isDragging
              ? 'border-[#83A58E] bg-[#EEF4F0] ring-2 ring-[#83A58E]/40'
              : 'border-[#D9E5DC] bg-white hover:bg-[#FAFBF9] hover:border-[#83A58E]'
          }`}
        >
          <div className="w-11 h-11 rounded-full bg-[#EEF4F0] text-[#4A6453] flex items-center justify-center mx-auto mb-2.5 group-hover:scale-105 transition-transform shadow-2xs">
            <Upload className="w-5 h-5" />
          </div>

          <h4 className="text-xs md:text-sm font-bold text-[#3D4740]">
            Bấm để chọn tệp PowerPoint (.pptx) hoặc kéo thả vào đây
          </h4>

          <p className="text-[11px] text-[#768078] mt-1 max-w-md mx-auto leading-relaxed">
            Hỗ trợ tệp <strong>.pptx</strong> từ máy tính hoặc bộ nhớ điện thoại (Tối đa {MAX_PPTX_SIZE_MB} MB).
            Hệ thống sẽ đọc trực tiếp trên trình duyệt mà không tải lên máy chủ ngoài.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
            <span className="text-[10px] font-semibold text-[#4A6453] bg-[#EEF4F0] px-2 py-0.5 rounded border border-[#D9E5DC]">
              ✓ Kiểm tra Open XML
            </span>
            <span className="text-[10px] font-semibold text-[#4A6453] bg-[#EEF4F0] px-2 py-0.5 rounded border border-[#D9E5DC]">
              ✓ Đếm slide tự động
            </span>
            <span className="text-[10px] text-[#768078] bg-[#FAFBF9] px-2 py-0.5 rounded border border-[#E4E9E3]">
              Chỉ nhận .pptx
            </span>
          </div>
        </div>
      ) : null}

      {/* Note about Phase 2.1 scope */}
      <div className="p-3 rounded-lg bg-[#FAFBF9] border border-[#E4E9E3] text-xs text-[#556057] flex items-start gap-2">
        <Info className="w-4 h-4 text-[#83A58E] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-[#3D4740]">Thông tin Đợt 2.1:</span>{' '}
          Bạn có thể tải lên tệp PPTX thật để hệ thống kiểm tra và lưu vào phiên. Khi vào phòng luyện tập, thông tin tài liệu sẽ được ghi nhận; bộ dựng từng trang slide chi tiết sẽ được tích hợp ở Đợt 2.2.
        </div>
      </div>
    </div>
  );
};
