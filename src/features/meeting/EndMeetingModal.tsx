/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  FileCheck,
  RotateCcw,
  LayoutDashboard,
  Award,
  Sparkles
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

interface EndMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmViewReport: () => void;
  onReturnToDashboard: () => void;
  elapsedSeconds: number;
}

export const EndMeetingModal: React.FC<EndMeetingModalProps> = ({
  isOpen,
  onClose,
  onConfirmViewReport,
  onReturnToDashboard,
  elapsedSeconds,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m} phút ${s < 10 ? '0' : ''}${s} giây`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kết thúc buổi luyện thuyết trình"
      subtitle="Bạn đã hoàn thành phiên luyện tập trong phòng họp mô phỏng"
      maxWidth="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Tiếp tục luyện tập
          </Button>
          <Button variant="outline" size="sm" onClick={onReturnToDashboard}>
            Về Tổng quan
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<FileCheck className="w-4 h-4" />}
            onClick={onConfirmViewReport}
          >
            Xem báo cáo đánh giá
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-1 text-sm text-[#3D4740]">
        <div className="p-4 rounded-xl bg-[#F7F9F6] border border-[#E4E9E3] space-y-2">
          <div className="flex items-center justify-between text-xs text-[#768078]">
            <span>Thời lượng buổi nói:</span>
            <span className="font-semibold text-[#3D4740] font-mono">
              {formatTime(elapsedSeconds)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-[#768078]">
            <span>Trạng thái đánh giá:</span>
            <span className="font-semibold text-[#4A6453]">
              Bản phân tích demo đã sẵn sàng
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 text-xs text-[#556057] bg-[#EEF4F0] p-3 rounded-xl border border-[#D9E5DC]">
          <Sparkles className="w-4 h-4 text-[#83A58E] shrink-0 mt-0.5" />
          <p>
            Bạn có thể chuyển ngay sang màn hình <strong>Báo cáo đánh giá</strong> để xem thử nghiệm các chỉ số phân tích nhịp nói, từ đệm và nhận xét mẫu từ ban giám khảo.
          </p>
        </div>
      </div>
    </Modal>
  );
};
