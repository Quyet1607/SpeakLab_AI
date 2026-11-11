/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Users,
  Award,
  MicOff,
  Sparkles,
  MessageSquare,
  ThumbsUp,
  Brain,
  Volume2
} from 'lucide-react';
import { VirtualParticipant } from '../../types';

interface AttendeeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  participants: VirtualParticipant[];
  onTriggerSimulatedQuestion: (judgeName: string) => void;
}

export const AttendeeDrawer: React.FC<AttendeeDrawerProps> = ({
  isOpen,
  onClose,
  participants,
  onTriggerSimulatedQuestion,
}) => {
  const [filter, setFilter] = useState<'all' | 'judges' | 'audience'>('all');

  if (!isOpen) return null;

  const judges = participants.filter((p) => p.role === 'judge');
  const audience = participants.filter((p) => p.role === 'audience');

  const filtered =
    filter === 'judges'
      ? judges
      : filter === 'audience'
      ? audience
      : participants;

  return (
    <div className="absolute inset-y-0 right-0 lg:relative w-80 md:w-96 max-w-[90vw] bg-[#1F2621] border-l border-[#2E3A31] flex flex-col h-full shadow-2xl z-40 lg:z-20 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 px-4 border-b border-[#2E3A31] flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#83A58E]" />
          <span className="text-sm font-bold">Người tham dự mô phỏng</span>
          <span className="text-xs bg-[#2B382F] text-[#83A58E] px-2 py-0.5 rounded-full font-mono">
            {participants.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-[#A8B6AB] hover:text-white hover:bg-[#2B382F]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="p-3 border-b border-[#2E3A31] flex items-center gap-1.5">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 text-xs rounded-lg transition-colors font-medium ${
            filter === 'all'
              ? 'bg-[#83A58E] text-white'
              : 'text-[#A8B6AB] hover:text-white hover:bg-[#2B382F]'
          }`}
        >
          Tất cả ({participants.length})
        </button>
        <button
          onClick={() => setFilter('judges')}
          className={`flex-1 py-1.5 text-xs rounded-lg transition-colors font-medium ${
            filter === 'judges'
              ? 'bg-[#83A58E] text-white'
              : 'text-[#A8B6AB] hover:text-white hover:bg-[#2B382F]'
          }`}
        >
          Giám khảo ({judges.length})
        </button>
        <button
          onClick={() => setFilter('audience')}
          className={`flex-1 py-1.5 text-xs rounded-lg transition-colors font-medium ${
            filter === 'audience'
              ? 'bg-[#83A58E] text-white'
              : 'text-[#A8B6AB] hover:text-white hover:bg-[#2B382F]'
          }`}
        >
          Thính giả ({audience.length})
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.map((p) => {
          const isJudge = p.role === 'judge';

          return (
            <div
              key={p.id}
              className="p-3 rounded-xl bg-[#263129] border border-[#334237] space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    style={{ backgroundColor: p.avatarBg }}
                    className="w-8 h-8 rounded-full text-white font-bold flex items-center justify-center text-xs shadow-xs"
                  >
                    {p.avatarInitials}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-white">{p.name}</p>
                      {isJudge && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#364939] text-[#BED3C4] border border-[#445E49] font-medium">
                          Giám khảo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#A8B6AB] line-clamp-1">{p.title}</p>
                  </div>
                </div>

                <div className="text-[#889B8D]">
                  <MicOff className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Status and Action */}
              <div className="pt-2 border-t border-[#334237]/80 flex items-center justify-between text-[11px] text-[#A8B6AB]">
                <span className="flex items-center gap-1 truncate max-w-[180px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#83A58E]" />
                  {p.statusText}
                </span>

                {isJudge && (
                  <button
                    onClick={() => onTriggerSimulatedQuestion(p.name)}
                    className="text-[10px] text-[#83A58E] hover:text-[#A7C8B1] bg-[#1E2620] px-2 py-0.5 rounded border border-[#37483B] transition-colors cursor-pointer"
                  >
                    Mô phỏng hỏi
                  </button>
                )}
              </div>

              {p.feedbackNote && (
                <div className="p-2 rounded bg-[#1D2520] border border-[#2B382F] text-[10px] text-[#BED3C4] italic">
                  "{p.feedbackNote}"
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Simulator Action Tip */}
      <div className="p-3 border-t border-[#2E3A31] bg-[#19201B] text-[11px] text-[#8A9C8F]">
        <div className="flex items-center gap-1.5 font-semibold text-white mb-1">
          <Sparkles className="w-3.5 h-3.5 text-[#83A58E]" />
          <span>Mô phỏng phản hồi thính phòng</span>
        </div>
        <p className="leading-relaxed">
          Ở Đợt 2, hội đồng AI sẽ chủ động tương tác bằng giọng nói khi bạn hoàn tất một luận điểm chính.
        </p>
      </div>
    </div>
  );
};
