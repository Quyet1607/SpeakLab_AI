/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  FileText,
  MousePointer,
  Share2,
  BarChart3,
  GitBranch,
  Layers,
  Award,
  CheckCircle2,
  Eye,
  ScrollText,
  FileCheck,
  Sparkles,
  Info,
  AlertCircle,
  RefreshCw,
  Smartphone,
  Square,
  Monitor
} from 'lucide-react';
import { PresentationSlide, PresentationSource } from '../../types';
import { pptxSessionStore } from '../../services/pptxService';

interface SlideViewerProps {
  slides: PresentationSlide[];
  currentSlideIndex: number;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onSelectSlide: (index: number) => void;
  onShareScreenClick: () => void;
  onToggleNotes: () => void;
  isNotesOpen: boolean;
  presentationSource?: PresentationSource;
  onSwitchToDemo?: () => void;
  screenStream?: MediaStream | null;
  onStopScreenShare?: () => void;
}

// Fallback virtual canvas coordinate system (16:9)
const DEFAULT_SLIDE_WIDTH = 960;
const DEFAULT_SLIDE_HEIGHT = 540;

export const SlideViewer: React.FC<SlideViewerProps> = ({
  slides,
  currentSlideIndex,
  onPrevSlide,
  onNextSlide,
  onSelectSlide,
  onShareScreenClick,
  onToggleNotes,
  isNotesOpen,
  presentationSource,
  onSwitchToDemo,
  screenStream,
  onStopScreenShare,
}) => {
  const [laserActive, setLaserActive] = useState(false);
  const [laserPos, setLaserPos] = useState({ x: 50, y: 50 });
  const [viewMode, setViewMode] = useState<'fit' | 'scroll'>('fit');
  const [showPptxEffectTip, setShowPptxEffectTip] = useState(true);

  // Container dimensions via ResizeObserver
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const isScreenShare = presentationSource?.type === 'screenShare';
  const isPptx = presentationSource?.type === 'pptx';
  const currentDemoSlide = slides[currentSlideIndex] || slides[0];

  // Connect screen capture stream to video element
  useEffect(() => {
    if (isScreenShare && videoRef.current) {
      videoRef.current.srcObject = screenStream || null;
    }
  }, [isScreenShare, screenStream]);

  // PPTX Real Presentation State
  const [isLoadingPptx, setIsLoadingPptx] = useState(false);
  const [pptxError, setPptxError] = useState<string | null>(null);
  const [pptxSvg, setPptxSvg] = useState<string | null>(null);
  const [slideDimensions, setSlideDimensions] = useState<{ width: number; height: number }>({
    width: DEFAULT_SLIDE_WIDTH,
    height: DEFAULT_SLIDE_HEIGHT,
  });
  const [totalPptxSlides, setTotalPptxSlides] = useState<number>(
    presentationSource?.slideCount || 1
  );

  // Dynamic measuring of available canvas area using ResizeObserver
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const updateDimensions = () => {
      if (el) {
        setContainerDimensions({
          width: el.clientWidth,
          height: el.clientHeight,
        });
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });

    resizeObserver.observe(el);
    window.addEventListener('resize', updateDimensions);
    window.addEventListener('orientationchange', updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
    };
  }, []);

  // Reset scroll position when slide changes or when switching to fit mode
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentSlideIndex]);

  // Load and parse real PPTX presentation via @web-ppt/core
  useEffect(() => {
    if (!isPptx) {
      setPptxSvg(null);
      setPptxError(null);
      setIsLoadingPptx(false);
      return;
    }

    let isMounted = true;
    const loadRealPptx = async () => {
      setIsLoadingPptx(true);
      setPptxError(null);

      try {
        const file = presentationSource?.pptxInfo?.file || pptxSessionStore.getPptx()?.file;
        if (!file) {
          throw new Error('Tệp PowerPoint không còn trong bộ nhớ phiên. Vui lòng quay lại trang chuẩn bị để chọn tệp.');
        }

        const pres = await pptxSessionStore.loadPresentation(file);
        if (!pres || pres.slides.length === 0) {
          throw new Error('Tệp PowerPoint hợp lệ nhưng không tìm thấy slide nào để trình chiếu.');
        }

        if (!isMounted) return;

        const nativeW = pres.width > 0 ? pres.width : DEFAULT_SLIDE_WIDTH;
        const nativeH = pres.height > 0 ? pres.height : DEFAULT_SLIDE_HEIGHT;

        setSlideDimensions({ width: nativeW, height: nativeH });
        setTotalPptxSlides(pres.slides.length);

        const safeIndex = Math.min(Math.max(0, currentSlideIndex), pres.slides.length - 1);
        const svgString = pptxSessionStore.renderSlideSvg(safeIndex);
        setPptxSvg(svgString);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Lỗi khi dựng nội dung slide PowerPoint.';
        setPptxError(msg);
      } finally {
        if (isMounted) {
          setIsLoadingPptx(false);
        }
      }
    };

    loadRealPptx();

    return () => {
      isMounted = false;
    };
  }, [isPptx, presentationSource?.pptxInfo?.file]);

  // Render slide when currentSlideIndex changes in PPTX mode
  useEffect(() => {
    if (!isPptx || isLoadingPptx) return;

    try {
      const pres = pptxSessionStore.getParsedPresentation();
      if (pres && pres.slides.length > 0) {
        const safeIndex = Math.min(Math.max(0, currentSlideIndex), pres.slides.length - 1);
        const svgString = pptxSessionStore.renderSlideSvg(safeIndex);
        setPptxSvg(svgString);
      }
    } catch (err: unknown) {
      console.error('Lỗi khi chuyển slide PPTX:', err);
    }
  }, [currentSlideIndex, isPptx, isLoadingPptx]);

  const handleToggleViewMode = () => {
    if (viewMode === 'scroll') {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      setViewMode('fit');
    } else {
      setViewMode('scroll');
    }
  };

  // Determine active native slide dimensions (16:9, 4:3, or custom from PPTX)
  const activeSlideWidth = isPptx ? slideDimensions.width : DEFAULT_SLIDE_WIDTH;
  const activeSlideHeight = isPptx ? slideDimensions.height : DEFAULT_SLIDE_HEIGHT;

  // Two-axis proportional scale calculation with responsive padding for mobile & landscape
  const paddingX = containerDimensions.width < 450 ? 8 : containerDimensions.width < 768 ? 14 : 24;
  const paddingY = containerDimensions.height < 360 ? 6 : containerDimensions.height < 500 ? 10 : 20;
  const availW = Math.max(80, containerDimensions.width - paddingX);
  const availH = Math.max(80, containerDimensions.height - paddingY);

  const scaleX = availW / activeSlideWidth;
  const scaleY = availH / activeSlideHeight;
  const rawScale = Math.min(scaleX, scaleY);
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;

  // Track laser position relative to the slide sheet
  const handleSlideMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!laserActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
      setLaserPos({ x, y });
    }
  };

  const totalEffectiveSlides = isPptx ? totalPptxSlides : slides.length;

  const renderVisualGraphic = (type?: string) => {
    switch (type) {
      case 'chart':
        return (
          <div className="bg-[#FAFBF9] border border-[#E4E9E3] rounded-xl p-3 md:p-4 flex flex-col justify-between h-[190px]">
            <div className="flex items-center justify-between text-xs text-[#768078]">
              <span className="font-semibold text-[#3D4740] flex items-center gap-1.5 text-xs">
                <BarChart3 className="w-3.5 h-3.5 text-[#83A58E] shrink-0" />
                <span className="truncate">Độ chính xác theo tuần thử nghiệm</span>
              </span>
              <span className="text-[10px]">Đơn vị: %</span>
            </div>
            <div className="flex items-end justify-around h-28 pt-2 gap-3">
              {[
                { week: 'T1', fullWeek: 'Tuần 1', val: 72 },
                { week: 'T2', fullWeek: 'Tuần 2', val: 81 },
                { week: 'T3', fullWeek: 'Tuần 3', val: 89 },
                { week: 'T4', fullWeek: 'Tuần 4', val: 94 },
              ].map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <span className="text-[11px] font-bold text-[#324C3B] tabular-nums">
                    {item.val}%
                  </span>
                  <div
                    style={{ height: `${item.val}%` }}
                    className="w-full max-w-[42px] bg-[#83A58E] hover:bg-[#6F917A] transition-all rounded-t-md"
                  />
                  <span className="text-[11px] text-[#768078] font-medium">{item.fullWeek}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'process':
        return (
          <div className="bg-[#FAFBF9] border border-[#E4E9E3] rounded-xl p-3 md:p-4 flex flex-col justify-around h-[190px]">
            <div className="text-xs font-semibold text-[#3D4740] flex items-center gap-1.5 mb-2">
              <GitBranch className="w-3.5 h-3.5 text-[#83A58E] shrink-0" />
              <span>Quy trình nhận diện và mở ngăn rác</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-[#E4E9E3] shadow-2xs">
                <div className="w-5 h-5 rounded-full bg-[#EEF4F0] text-[#324C3B] text-[10px] font-bold mx-auto mb-1 flex items-center justify-center">
                  1
                </div>
                <p className="font-semibold text-[#3D4740] text-xs">Quét Camera</p>
                <p className="text-[10px] text-[#768078] mt-0.5">350ms</p>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-[#E4E9E3] shadow-2xs">
                <div className="w-5 h-5 rounded-full bg-[#EEF4F0] text-[#324C3B] text-[10px] font-bold mx-auto mb-1 flex items-center justify-center">
                  2
                </div>
                <p className="font-semibold text-[#3D4740] text-xs">Phân loại AI</p>
                <p className="text-[10px] text-[#768078] mt-0.5">94.2%</p>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-[#E4E9E3] shadow-2xs">
                <div className="w-5 h-5 rounded-full bg-[#EEF4F0] text-[#324C3B] text-[10px] font-bold mx-auto mb-1 flex items-center justify-center">
                  3
                </div>
                <p className="font-semibold text-[#3D4740] text-xs">Mở ngăn tự động</p>
                <p className="text-[10px] text-[#768078] mt-0.5">0.5s</p>
              </div>
            </div>
          </div>
        );

      case 'comparison':
        return (
          <div className="bg-[#FAFBF9] border border-[#E4E9E3] rounded-xl p-3 md:p-4 flex flex-col justify-between h-[190px]">
            <div className="text-xs font-semibold text-[#3D4740] flex items-center gap-1.5 mb-2">
              <Layers className="w-3.5 h-3.5 text-[#83A58E] shrink-0" />
              <span>So sánh hiệu quả với phương pháp thủ công</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-[#E4E9E3]">
                <p className="font-semibold text-[#768078] text-[11px]">Thùng rác thông thường</p>
                <p className="text-sm font-bold text-[#3D4740] mt-0.5">38% lẫn rác</p>
                <p className="text-[10px] text-[#768078] mt-0.5">Phụ thuộc cảm tính</p>
              </div>
              <div className="p-3 bg-[#EEF4F0] rounded-lg border border-[#D9E5DC]">
                <p className="font-semibold text-[#324C3B] text-[11px]">SmartBin AI Box</p>
                <p className="text-sm font-bold text-[#2A4433] mt-0.5">6.5% lẫn rác</p>
                <p className="text-[10px] text-[#4A6453] mt-0.5">Tự động dẫn hướng</p>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-[#EEF4F0] border border-[#D9E5DC] rounded-xl p-4 flex flex-col items-center justify-center text-center h-[190px]">
            <Award className="w-8 h-8 text-[#5A7D65] mb-2" />
            <p className="text-xs font-bold text-[#2A4433]">
              Sẵn sàng cho phần hỏi đáp & phản biện
            </p>
            <p className="text-[11px] text-[#4A6453] mt-1 max-w-xs leading-relaxed">
              Ban giám khảo và các thính giả mô phỏng đang chuẩn bị câu hỏi dành cho bạn.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1A211C] rounded-2xl border border-[#2D3830] overflow-hidden shadow-lg relative min-h-0 w-full h-full">
      {/* 1. Top Slide Header toolbar inside meeting */}
      <div className="h-10 sm:h-11 bg-[#242C26] border-b border-[#2D3830] px-2 sm:px-4 flex items-center justify-between text-xs text-[#A8B6AB] shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isScreenShare ? 'bg-[#83A58E] animate-pulse ring-2 ring-[#83A58E]/40' : 'bg-[#83A58E]'}`} />
          <span className="font-medium text-white truncate max-w-[130px] sm:max-w-xs md:max-w-md">
            {isScreenShare
              ? 'Phát trực tiếp: Cửa sổ PowerPoint'
              : isPptx
              ? `Tệp PPTX: ${presentationSource.name}`
              : `Slide ${currentSlideIndex + 1}: ${currentDemoSlide.title}`}
          </span>
          {!isScreenShare ? (
            <span className="text-[10px] bg-[#2E3A31] text-[#A8B6AB] px-1.5 py-0.5 rounded font-mono shrink-0">
              Slide {currentSlideIndex + 1}/{totalEffectiveSlides}
            </span>
          ) : (
            <span className="text-[10px] bg-[#1E2721] text-[#83A58E] px-2 py-0.5 rounded font-medium shrink-0 border border-[#2D3930] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#83A58E]" />
              <span>Hiệu ứng trực tiếp</span>
            </span>
          )}

          {isPptx && !isScreenShare && (
            <span className="hidden lg:inline text-[10px] text-[#83A58E] bg-[#1E2721] px-1.5 py-0.5 rounded border border-[#2D3930]">
              Tỷ lệ gốc: {activeSlideWidth}:{activeSlideHeight}
            </span>
          )}
        </div>

        {/* Action Controls in toolbar */}
        <div className="flex items-center gap-1 shrink-0">
          {isScreenShare ? (
            /* Controls during active Screen Share */
            <div className="flex items-center gap-1.5">
              <button
                onClick={onToggleNotes}
                className={`p-1.5 rounded-md transition-colors text-xs flex items-center gap-1 cursor-pointer ${
                  isNotesOpen
                    ? 'bg-[#83A58E] text-white'
                    : 'text-[#A8B6AB] hover:text-white hover:bg-[#2E3A31]'
                }`}
                title="Mở kịch bản người nói"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Kịch bản</span>
              </button>

              <button
                onClick={onStopScreenShare}
                className="px-2.5 py-1 rounded-md bg-[#873631] hover:bg-[#A33E37] text-white transition-colors text-xs flex items-center gap-1.5 cursor-pointer font-medium shadow-2xs"
                title="Dừng chia sẻ màn hình và quay lại slide nội bộ"
              >
                <Square className="w-3 h-3 fill-current" />
                <span className="text-[11px]">Dừng chia sẻ</span>
              </button>
            </div>
          ) : (
            /* Controls during Slide Viewer (PPTX / Demo) */
            <>
              {isPptx && (
                <button
                  onClick={onShareScreenClick}
                  className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#253127] text-[#83A58E] hover:text-white hover:bg-[#314034] border border-[#37493A] transition-colors text-[11px] cursor-pointer"
                  title="Chuyển sang Chia sẻ màn hình để chạy đầy đủ hiệu ứng PowerPoint"
                >
                  <Sparkles className="w-3 h-3 text-[#83A58E]" />
                  <span>Chiếu có hiệu ứng</span>
                </button>
              )}

              {/* View mode toggle: Fit vs Scroll */}
              <button
                onClick={handleToggleViewMode}
                className={`p-1.5 rounded-md transition-colors text-xs flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'fit'
                    ? 'bg-[#83A58E] text-white'
                    : 'text-[#A8B6AB] hover:text-white hover:bg-[#2E3A31]'
                }`}
                title={viewMode === 'fit' ? 'Đang ở chế độ Vừa khung (bấm để Cuộn đọc)' : 'Đang ở chế độ Cuộn đọc (bấm để Vừa khung)'}
              >
                {viewMode === 'fit' ? <Eye className="w-3.5 h-3.5" /> : <ScrollText className="w-3.5 h-3.5" />}
                <span className="text-[11px] font-medium hidden sm:inline">
                  {viewMode === 'fit' ? `Vừa khung (${Math.round(scale * 100)}%)` : 'Cuộn đọc'}
                </span>
                <span className="text-[11px] font-medium sm:hidden">
                  {viewMode === 'fit' ? 'Vừa khung' : 'Cuộn đọc'}
                </span>
              </button>

              {/* Laser Pointer */}
              <button
                onClick={() => setLaserActive(!laserActive)}
                className={`p-1.5 rounded-md transition-colors text-xs flex items-center gap-1 cursor-pointer ${
                  laserActive
                    ? 'bg-[#83A58E] text-white'
                    : 'text-[#A8B6AB] hover:text-white hover:bg-[#2E3A31]'
                }`}
                title="Bật/Tắt con trỏ laser mô phỏng"
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Con trỏ laser</span>
              </button>

              {/* Notes Drawer Toggle */}
              <button
                onClick={onToggleNotes}
                className={`p-1.5 rounded-md transition-colors text-xs flex items-center gap-1 cursor-pointer ${
                  isNotesOpen
                    ? 'bg-[#83A58E] text-white'
                    : 'text-[#A8B6AB] hover:text-white hover:bg-[#2E3A31]'
                }`}
                title="Mở kịch bản người nói"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Kịch bản</span>
              </button>

              {/* Share screen button */}
              <button
                onClick={onShareScreenClick}
                className="p-1.5 rounded-md text-[#A8B6AB] hover:text-white hover:bg-[#2E3A31] transition-colors text-xs flex items-center gap-1 cursor-pointer"
                title="Chia sẻ màn hình PowerPoint có hiệu ứng (Đợt 2.3)"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-[11px]">Chia sẻ</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Optional Mode A (PPTX) Tip banner for Animation/Transition */}
      {isPptx && !isScreenShare && showPptxEffectTip && (
        <div className="bg-[#242F27] border-b border-[#324235] px-3 md:px-4 py-1.5 flex items-center justify-between text-[11px] text-[#A8B6AB] shrink-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <Info className="w-3.5 h-3.5 text-[#83A58E] shrink-0" />
            <span className="truncate">
              Chế độ này hiển thị chính xác nội dung nhưng chưa hỗ trợ đầy đủ hiệu ứng PowerPoint. Để sử dụng hiệu ứng gốc (Animation & Transition), hãy chọn{' '}
              <button
                onClick={onShareScreenClick}
                className="text-[#83A58E] font-semibold underline hover:text-white cursor-pointer ml-1"
              >
                Chia sẻ màn hình
              </button>
              .
            </span>
          </div>
          <button
            onClick={() => setShowPptxEffectTip(false)}
            className="text-[#768078] hover:text-white px-1.5 py-0.5 rounded cursor-pointer shrink-0 ml-2 text-[10px]"
            title="Đóng thông báo"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 2. Slide Canvas Stage */}
      <div
        ref={containerRef}
        className="flex-1 relative w-full h-full min-h-0 flex items-center justify-center overflow-hidden bg-[#1F2621]"
      >
        {isScreenShare ? (
          /* ================= SCREEN SHARE STAGE (PHASE 2.3) ================= */
          <div className="w-full h-full p-2 sm:p-3 flex flex-col items-center justify-center relative min-h-0">
            <div className="w-full h-full max-w-full max-h-full flex items-center justify-center relative rounded-xl overflow-hidden shadow-2xl bg-black border border-[#2D3930]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />


            </div>
          </div>
        ) : isPptx ? (
          /* ================= REAL PPTX RENDERING STAGE ================= */
          isLoadingPptx ? (
            /* Loading State while @web-ppt/core parses and renders */
            <div className="p-6 md:p-8 rounded-2xl bg-[#1A221C] border border-[#2D3930] text-center max-w-md mx-auto space-y-3 shadow-xl">
              <div className="w-10 h-10 mx-auto border-3 border-[#83A58E] border-t-transparent rounded-full animate-spin" />
              <h4 className="text-sm font-bold text-white">Đang chuẩn bị bài trình chiếu...</h4>
              <p className="text-xs text-[#A8B6AB] break-all">
                Đang giải mã slide thật từ tệp: <strong className="text-white">{presentationSource.name}</strong>
              </p>
              <div className="p-2.5 rounded-lg bg-[#242E26] border border-[#2E3B30] text-[11px] text-[#83A58E] flex items-center justify-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Trình chiếu Open XML không máy chủ · Xử lý an toàn trên trình duyệt</span>
              </div>
            </div>
          ) : pptxError ? (
            /* Error State if parsing fails */
            <div className="p-6 rounded-2xl bg-[#261B1B] border border-[#4D2826] text-center max-w-md mx-auto space-y-3">
              <AlertCircle className="w-8 h-8 text-[#E5484D] mx-auto" />
              <h4 className="text-sm font-bold text-white">Không thể hiển thị slide PowerPoint</h4>
              <p className="text-xs text-[#ECA9A7] leading-relaxed">{pptxError}</p>
              <div className="flex items-center justify-center gap-2 pt-2">
                {onSwitchToDemo && (
                  <button
                    onClick={onSwitchToDemo}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#83A58E] text-white font-medium hover:bg-[#6F917A] cursor-pointer"
                  >
                    Dùng slide mẫu diễn tập
                  </button>
                )}
              </div>
            </div>
          ) : viewMode === 'fit' ? (
            /* "VỪA KHUNG" MODE FOR REAL PPTX: Exact 2-axis proportional scaling */
            <div
              style={{
                width: `${Math.round(activeSlideWidth * scale)}px`,
                height: `${Math.round(activeSlideHeight * scale)}px`,
                position: 'relative',
                flexShrink: 0,
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            >
              <div
                onMouseMove={handleSlideMouseMove}
                style={{
                  width: `${activeSlideWidth}px`,
                  height: `${activeSlideHeight}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
                className="bg-white rounded-xl shadow-2xl border border-[#E4E9E3] select-none overflow-hidden absolute top-0 left-0 [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                dangerouslySetInnerHTML={{ __html: pptxSvg || '' }}
              />

              {/* Laser pointer dot on scaled surface */}
              {laserActive && (
                <div
                  style={{
                    left: `${laserPos.x}%`,
                    top: `${laserPos.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className="absolute w-4 h-4 rounded-full bg-[#E5484D] shadow-[0_0_14px_#E5484D] pointer-events-none transition-transform duration-75 z-30 ring-2 ring-white/60"
                />
              )}
            </div>
          ) : (
            /* "CUỘN ĐỌC" MODE FOR REAL PPTX: Scrollable natural reading mode */
            <div
              ref={scrollContainerRef}
              className="w-full h-full overflow-y-auto p-3 sm:p-5 flex flex-col items-center"
            >
              <div
                onMouseMove={handleSlideMouseMove}
                style={{
                  maxWidth: '1020px',
                  width: '100%',
                  aspectRatio: `${activeSlideWidth} / ${activeSlideHeight}`,
                }}
                className="bg-white rounded-xl shadow-xl overflow-hidden border border-[#E4E9E3] my-auto relative [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                dangerouslySetInnerHTML={{ __html: pptxSvg || '' }}
              />

              {/* Laser pointer in scroll mode */}
              {laserActive && (
                <div
                  style={{
                    left: `${laserPos.x}%`,
                    top: `${laserPos.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className="absolute w-4 h-4 rounded-full bg-[#E5484D] shadow-[0_0_14px_#E5484D] pointer-events-none transition-transform duration-75 z-30 ring-2 ring-white/60"
                />
              )}
            </div>
          )
        ) : (
          /* ================= DEMO SLIDE STAGE (PHASE 1) ================= */
          viewMode === 'fit' ? (
            /* "VỪA KHUNG" MODE: Mathematical 2-axis proportional scaling to guarantee 100% visibility */
            <div
              style={{
                width: `${Math.round(DEFAULT_SLIDE_WIDTH * scale)}px`,
                height: `${Math.round(DEFAULT_SLIDE_HEIGHT * scale)}px`,
                position: 'relative',
                flexShrink: 0,
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            >
              <div
                onMouseMove={handleSlideMouseMove}
                style={{
                  width: `${DEFAULT_SLIDE_WIDTH}px`,
                  height: `${DEFAULT_SLIDE_HEIGHT}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
                className="bg-white rounded-xl shadow-2xl p-6 flex flex-col justify-between border border-[#E4E9E3] text-[#3D4740] select-none overflow-hidden absolute top-0 left-0"
              >
                {/* Slide Header */}
                <div className="shrink-0">
                  <div className="flex items-center justify-between text-xs text-[#768078] pb-2 border-b border-[#E4E9E3]">
                    <span className="font-semibold text-[#4A6453] uppercase tracking-wider text-[11px]">
                      SpeakLab AI · Nghiên cứu Khoa học 2026
                    </span>
                    <span className="tabular-nums font-mono text-[11px] font-semibold text-[#3D4740]">
                      Slide {currentDemoSlide.slideNumber} / {slides.length}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-[#3D4740] mt-2 tracking-tight leading-snug">
                    {currentDemoSlide.title}
                  </h2>
                  {currentDemoSlide.subtitle && (
                    <p className="text-xs text-[#768078] mt-0.5 font-medium leading-relaxed">
                      {currentDemoSlide.subtitle}
                    </p>
                  )}
                </div>

                {/* Slide Body: 2 columns with generous breathing room */}
                <div className="grid grid-cols-2 gap-5 my-auto py-2 items-center flex-1 min-h-0">
                  {/* Left Column: Points and Highlight */}
                  <div className="space-y-2.5">
                    {currentDemoSlide.contentPoints.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-[#444F47]">
                        <CheckCircle2 className="w-4 h-4 text-[#83A58E] shrink-0 mt-0.5" />
                        <span className="leading-relaxed font-medium">{point}</span>
                      </div>
                    ))}

                    {currentDemoSlide.keyHighlight && (
                      <div className="mt-3 p-3 rounded-lg bg-[#EEF4F0] border border-[#D9E5DC] text-xs font-semibold text-[#2A4433] leading-relaxed">
                        💡 {currentDemoSlide.keyHighlight}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Visual Graphic */}
                  <div className="h-full flex flex-col justify-center">
                    {renderVisualGraphic(currentDemoSlide.visualGraphicType)}
                  </div>
                </div>

                {/* Slide Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-[#E4E9E3] text-[11px] text-[#768078] shrink-0 mt-auto">
                  <span className="truncate max-w-[420px]">
                    Người trình bày: Nguyễn Minh Quân · Lớp 11A1 chuyên Tin
                  </span>
                  <span className="shrink-0 font-medium text-[#4A6453]">Phòng họp SpeakLab AI</span>
                </div>

                {/* Laser pointer dot */}
                {laserActive && (
                  <div
                    style={{
                      left: `${laserPos.x}%`,
                      top: `${laserPos.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className="absolute w-4 h-4 rounded-full bg-[#E5484D] shadow-[0_0_14px_#E5484D] pointer-events-none transition-transform duration-75 z-30 ring-2 ring-white/60"
                  />
                )}
              </div>
            </div>
          ) : (
            /* "CUỘN ĐỌC" MODE: Vertical document view allowing manual scroll */
            <div
              ref={scrollContainerRef}
              className="w-full h-full overflow-y-auto p-3 sm:p-5 flex flex-col items-center"
            >
              <div
                onMouseMove={handleSlideMouseMove}
                className="w-full max-w-3xl bg-white rounded-xl shadow-xl p-5 sm:p-7 flex flex-col gap-4 border border-[#E4E9E3] text-[#3D4740] select-none relative my-auto"
              >
                {/* Slide Header */}
                <div>
                  <div className="flex items-center justify-between text-xs text-[#768078] pb-2 border-b border-[#E4E9E3]">
                    <span className="font-semibold text-[#4A6453] uppercase tracking-wider text-[10px]">
                      SpeakLab AI · Nghiên cứu Khoa học 2026
                    </span>
                    <span className="tabular-nums font-mono text-[11px] font-semibold text-[#3D4740]">
                      Slide {currentDemoSlide.slideNumber} / {slides.length}
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-bold text-[#3D4740] mt-2.5 tracking-tight leading-snug">
                    {currentDemoSlide.title}
                  </h2>
                  {currentDemoSlide.subtitle && (
                    <p className="text-xs sm:text-sm text-[#768078] mt-1 font-medium leading-relaxed">
                      {currentDemoSlide.subtitle}
                    </p>
                  )}
                </div>

                {/* Slide Body */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                  <div className="space-y-2.5">
                    {currentDemoSlide.contentPoints.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#444F47]">
                        <CheckCircle2 className="w-4 h-4 text-[#83A58E] shrink-0 mt-0.5" />
                        <span className="leading-relaxed font-medium">{point}</span>
                      </div>
                    ))}

                    {currentDemoSlide.keyHighlight && (
                      <div className="mt-3 p-3 rounded-lg bg-[#EEF4F0] border border-[#D9E5DC] text-xs font-semibold text-[#2A4433] leading-relaxed">
                        💡 {currentDemoSlide.keyHighlight}
                      </div>
                    )}
                  </div>

                  <div>
                    {renderVisualGraphic(currentDemoSlide.visualGraphicType)}
                  </div>
                </div>

                {/* Slide Footer */}
                <div className="flex items-center justify-between pt-2.5 border-t border-[#E4E9E3] text-[10px] text-[#768078] mt-2">
                  <span className="truncate max-w-[280px]">
                    Người trình bày: Nguyễn Minh Quân · Lớp 11A1 chuyên Tin
                  </span>
                  <span className="shrink-0 font-medium text-[#4A6453]">Phòng họp SpeakLab AI</span>
                </div>

                {/* Laser pointer dot */}
                {laserActive && (
                  <div
                    style={{
                      left: `${laserPos.x}%`,
                      top: `${laserPos.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className="absolute w-4 h-4 rounded-full bg-[#E5484D] shadow-[0_0_14px_#E5484D] pointer-events-none transition-transform duration-75 z-30 ring-2 ring-white/60"
                  />
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* Local PPTX/demo slides retain navigation; an external shared screen
          uses the full viewport with its stop button in the top toolbar. */}
      {!isScreenShare && (
        <div className="h-11 sm:h-12 bg-[#242C26] border-t border-[#2D3830] px-2 sm:px-4 flex items-center justify-between text-xs shrink-0">
          <button
            onClick={onPrevSlide}
            disabled={currentSlideIndex === 0}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#2E3A31] hover:bg-[#3B4A3F] disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px] sm:min-h-[38px] shrink-0"
            title="Về slide trước"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Slide trước</span>
          </button>

          {/* Slide Thumbnail / Number Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto max-w-[170px] sm:max-w-xs md:max-w-md py-1 scrollbar-none sm:scrollbar-thin touch-pan-x">
            {Array.from({ length: totalEffectiveSlides }, (_, idx) => (
              <button
                key={idx}
                onClick={() => onSelectSlide(idx)}
                className={`min-w-[28px] h-7 sm:w-7 sm:h-6 px-1 rounded flex items-center justify-center font-mono text-[11px] transition-all cursor-pointer shrink-0 ${
                  currentSlideIndex === idx
                    ? 'bg-[#83A58E] text-white font-bold ring-1 ring-white/30'
                    : 'bg-[#2E3A31] text-[#A8B6AB] hover:text-white hover:bg-[#3B4A3F]'
                }`}
                title={`Chuyển đến Slide ${idx + 1}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <button
            onClick={onNextSlide}
            disabled={currentSlideIndex >= totalEffectiveSlides - 1}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#83A58E] hover:bg-[#6F917A] disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center gap-1.5 font-semibold transition-colors cursor-pointer min-h-[36px] sm:min-h-[38px] shrink-0"
            title="Chuyển slide tiếp theo"
          >
            <span className="hidden sm:inline">Slide sau</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
