/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Share2,
  MonitorPlay,
  Layers,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { screenShareService } from '../../services/screenShareService';

interface ScreenShareGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmStartShare: () => void;
  isReplacingShare?: boolean;
}

export const ScreenShareGuideModal: React.FC<ScreenShareGuideModalProps> = ({
  isOpen,
  onClose,
  onConfirmStartShare,
  isReplacingShare = false,
}) => {
  const capability = screenShareService.getCapability();
  const isSupported = capability.isSupported;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSupported ? (isReplacingShare ? 'Đổi cửa sổ đang chia sẻ' : 'Chia sẻ màn hình PowerPoint có hiệu ứng') : 'Thông tin chia sẻ màn hình'}
      subtitle={isSupported ? 'Đợt 2.3 · Trình chiếu trực tiếp với Animation và Transition đầy đủ' : 'Khả năng hỗ trợ trên thiết bị hiện tại'}
      maxWidth="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {isSupported ? (isReplacingShare ? 'Giữ màn hình hiện tại' : 'Để sau') : 'Đóng'}
          </Button>

          {isSupported ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onConfirmStartShare}
              className="flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              <span>{isReplacingShare ? 'Chọn màn hình mới' : 'Bắt đầu chia sẻ ngay'}</span>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onClose}
              className="flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Tiếp tục dùng Slide nội bộ</span>
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-xs text-[#3D4740]">
        {!isSupported ? (
          /* ================= UNSUPPORTED RUNTIME NOTICE (MOBILE / RESTRICTED) ================= */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#FAFBF9] border border-[#E4E9E3] space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#FAF2EB] border border-[#E8D2BE] text-[#873631] flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#3D4740] leading-snug">
                    Thông báo tính năng chia sẻ màn hình
                  </h4>
                  <p className="text-xs text-[#556057] mt-1 leading-relaxed">
                    Trình duyệt hoặc thiết bị hiện tại chưa hỗ trợ chia sẻ màn hình trực tiếp. Bạn vẫn có thể tải PowerPoint để trình chiếu trong SpeakLab AI.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white border border-[#E4E9E3] space-y-2 text-[11px] text-[#556057]">
                <div className="flex items-center justify-between font-semibold text-[#3D4740]">
                  <span>Môi trường phát hiện:</span>
                  <span className="text-[#4A6453] bg-[#EEF4F0] px-2 py-0.5 rounded border border-[#D9E5DC]">
                    {capability.platformLabel}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-[#768078]">
                  {capability.technicalDetails || 'Trình duyệt di động hạn chế truyền màn hình qua Web API theo tiêu chuẩn an toàn của hệ điều hành.'}
                </p>
              </div>
            </div>

            {/* 2 Practical Alternatives */}
            <div className="space-y-2">
              <h5 className="font-bold text-[#3D4740] text-[11px] uppercase tracking-wider">
                Phương án đề xuất để luyện tập tốt nhất:
              </h5>

              <div className="p-3 rounded-xl bg-[#EEF4F0] border border-[#D9E5DC] flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#4A6453] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-[#2A4433]">Phương án 1 (Khuyên dùng trên điện thoại):</p>
                  <p className="text-[11px] text-[#4A6453] mt-0.5 leading-relaxed">
                    Sử dụng <strong>Chế độ trình chiếu PPTX nội bộ</strong>: Hệ thống hỗ trợ tải tệp .pptx thật từ điện thoại, hiển thị đầy đủ văn bản, biểu đồ, hình vẽ và hỗ trợ chế độ Vừa khung 100% không cần cuộn.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAFBF9] border border-[#E4E9E3] flex items-start gap-3">
                <MonitorPlay className="w-4 h-4 text-[#83A58E] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-[#3D4740]">Phương án 2 (Khi cần Animation & Transition):</p>
                  <p className="text-[11px] text-[#768078] mt-0.5 leading-relaxed">
                    Mở SpeakLab AI trên trình duyệt máy tính (Google Chrome hoặc Microsoft Edge) để chia sẻ trực tiếp cửa sổ PowerPoint có hiệu ứng chuyển động hoàn chỉnh.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= SUPPORTED RUNTIME (DESKTOP BROWSER) ================= */
          <>
            {/* Value Proposition Hero Banner */}
            <div className="p-3.5 rounded-xl bg-[#EEF4F0] border border-[#D9E5DC] flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#324C3B] text-white flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-[#83A58E]" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#2A4433] leading-snug">
                  Trình diễn bài nói với 100% hiệu ứng PowerPoint gốc
                </h4>
                <p className="text-[#4A6453] text-xs mt-0.5 leading-relaxed">
                  Các hiệu ứng chữ xuất hiện (Fly In, Fade, Zoom) và chuyển slide (Morph, Push, Wipe) của PowerPoint sẽ được truyền phát trực tiếp ở độ nét cao vào phòng họp SpeakLab AI.
                </p>
              </div>
            </div>

            {/* Section IX Anti-Mirror Warning Notice */}
            <div className="p-3 rounded-xl bg-[#FAF2EB] border border-[#E8D2BE] flex items-start gap-2.5 text-[#873631]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold block text-xs text-[#873631] mb-0.5">
                  Lưu ý quan trọng khi chọn màn hình:
                </span>
                Để trình chiếu PowerPoint có hiệu ứng, hãy chọn đúng <strong>cửa sổ trình chiếu PowerPoint</strong> trong hộp thoại của trình duyệt. <strong>Không chọn cửa sổ SpeakLab AI để tránh hình ảnh lặp lại.</strong>
              </div>
            </div>

        {/* 5-Step Guide */}
        <div>
          <h5 className="font-bold text-[#3D4740] mb-2.5 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <MonitorPlay className="w-3.5 h-3.5 text-[#83A58E]" />
            5 Bước thực hiện nhanh:
          </h5>

          <div className="space-y-2">
            {[
              {
                step: 1,
                title: 'Mở tệp PowerPoint trên máy tính của bạn',
                desc: 'Khởi chạy Microsoft PowerPoint (hoặc Google Slides / WPS Office) với tệp thuyết trình của bạn.',
              },
              {
                step: 2,
                title: 'Bật chế độ Trình chiếu (Slide Show)',
                desc: 'Nhấn phím F5 hoặc nút Slide Show trong PowerPoint để bắt đầu chiếu toàn màn hình hoặc cửa sổ.',
              },
              {
                step: 3,
                title: 'Nhấn nút "Bắt đầu chia sẻ ngay" bên dưới',
                desc: 'Hộp thoại chọn màn hình bảo mật của trình duyệt sẽ xuất hiện.',
              },
              {
                step: 4,
                title: 'Chọn thẻ "Cửa sổ" (Window) và chọn PowerPoint',
                desc: 'Ưu tiên chọn đúng cửa sổ trình chiếu PowerPoint thay vì toàn màn hình để thao tác mượt mà nhất.',
              },
              {
                step: 5,
                title: 'Thuyết trình và điều khiển phím trên PowerPoint',
                desc: 'Bấm phím cách (Space), Enter hoặc click chuột trên PowerPoint để chuyển slide. Hình ảnh và hiệu ứng sẽ tự động truyền vào SpeakLab AI.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex items-start gap-3 p-2.5 rounded-lg bg-[#FAFBF9] border border-[#E4E9E3]"
              >
                <div className="w-5 h-5 rounded-full bg-[#83A58E] text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  {item.step}
                </div>
                <div>
                  <p className="font-semibold text-[#3D4740] text-xs">{item.title}</p>
                  <p className="text-[11px] text-[#768078] mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Tips and Recommendations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
          {/* Tip 1: Single Monitor setup */}
          <div className="p-3 rounded-lg bg-[#F7F9F6] border border-[#E4E9E3] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-[#2A4433] text-[11px]">
              <HelpCircle className="w-3.5 h-3.5 text-[#83A58E] shrink-0" />
              <span>Mẹo trình chiếu trên 1 màn hình</span>
            </div>
            <p className="text-[11px] text-[#5A665E] leading-relaxed">
              Trong PowerPoint, vào <strong>Slide Show</strong> &rarr; <strong>Set Up Slide Show</strong> &rarr; chọn <strong>"Browsed by an individual (window)"</strong>. PowerPoint sẽ chiếu trong cửa sổ riêng giúp bạn vừa nhìn thấy hội đồng vừa điều khiển slide!
            </p>
          </div>

          {/* Tip 2: Infinite Mirror prevention */}
          <div className="p-3 rounded-lg bg-[#F7F9F6] border border-[#E4E9E3] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-[#873631] text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-[#873631] shrink-0" />
              <span>Tránh hiện tượng lặp gương vô hạn</span>
            </div>
            <p className="text-[11px] text-[#5A665E] leading-relaxed">
              Tránh chọn "Toàn bộ màn hình" (Entire Screen) khi đang mở chính tab phòng họp này. Hãy chọn tab <strong>"Cửa sổ" (Window)</strong> &rarr; <strong>PowerPoint Slide Show</strong> để hình ảnh luôn hiển thị sắc nét, không bị lặp gương.
            </p>
          </div>
        </div>

        {/* Audio notice & Return mechanism */}
        <div className="p-2.5 rounded-lg bg-[#FAFBF9] border border-[#E4E9E3] text-[11px] text-[#768078] flex items-center justify-between">
          <span>
            🔄 Bất cứ lúc nào bạn cũng có thể bấm <strong>"Dừng chia sẻ"</strong> để quay lại slide nội bộ ban đầu.
          </span>
          <span className="text-[#4A6453] font-semibold text-[10px] shrink-0 ml-2">
            Không nén giảm chất lượng
          </span>
        </div>
          </>
        )}
      </div>
    </Modal>
  );
};
