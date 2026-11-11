/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, Info, X } from 'lucide-react';

interface DemoNoticeProps {
  className?: string;
  variant?: 'banner' | 'card' | 'inline';
  title?: string;
  message?: string;
  isDismissable?: boolean;
}

export const DemoNotice: React.FC<DemoNoticeProps> = ({
  className = '',
  variant = 'banner',
  title = 'Phiên bản Giao diện Mô phỏng (Đợt 1)',
  message = 'Hệ thống đang hoạt động ở chế độ Demo với dữ liệu giả lập. Các tính năng nhận diện webcam thật, phân tích giọng nói tiếng Việt và câu hỏi phản biện AI sẽ được tích hợp ở các đợt phát triển tiếp theo.',
  isDismissable = true,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-[#526356] bg-[#EEF4F0] px-2 py-0.5 rounded border border-[#D9E5DC] ${className}`}>
        <Info className="w-3.5 h-3.5 text-[#83A58E] shrink-0" />
        <span>{message}</span>
      </span>
    );
  }

  return (
    <div
      className={`relative bg-[#F4F7F4] border border-[#D9E5DC] rounded-xl p-3.5 text-[#3D4740] flex items-start gap-3 transition-all ${className}`}
    >
      <div className="w-8 h-8 rounded-lg bg-[#EEF4F0] border border-[#D9E5DC] flex items-center justify-center shrink-0 mt-0.5 text-[#42614D]">
        <Sparkles className="w-4 h-4 text-[#60856E]" />
      </div>

      <div className="flex-1 pr-4">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#4A6453]">
            {title}
          </h4>
          <span className="text-[11px] text-[#768078]">· Đợt 1 / Kiến trúc Frontend</span>
        </div>
        <p className="text-xs text-[#5A695E] mt-0.5 leading-relaxed">
          {message}
        </p>
      </div>

      {isDismissable && (
        <button
          onClick={() => setDismissed(true)}
          className="text-[#768078] hover:text-[#3D4740] p-1 rounded-md transition-colors shrink-0"
          title="Đóng thông báo"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
