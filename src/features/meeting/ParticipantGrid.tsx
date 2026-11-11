/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  MicOff,
  Mic,
  Award,
  Users,
  MessageSquare,
  PenTool,
  Brain,
  Smile,
  Volume2
} from 'lucide-react';
import { VirtualParticipant } from '../../types';

interface ParticipantGridProps {
  participants: VirtualParticipant[];
  onParticipantClick?: (participant: VirtualParticipant) => void;
  orientation?: 'horizontal' | 'vertical';
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  participants,
  onParticipantClick,
  orientation = 'horizontal',
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'taking_notes':
        return <PenTool className="w-3 h-3 text-[#A8B6AB]" />;
      case 'analyzing':
        return <Brain className="w-3 h-3 text-[#A8B6AB]" />;
      case 'preparing_question':
        return <MessageSquare className="w-3 h-3 text-[#E8C27B]" />;
      case 'agreeing':
        return <Smile className="w-3 h-3 text-[#83A58E]" />;
      default:
        return <Users className="w-3 h-3 text-[#A8B6AB]" />;
    }
  };

  return (
    <div
      className={`flex gap-3 overflow-x-auto pb-1 ${
        orientation === 'vertical'
          ? 'flex-col overflow-y-auto max-h-[600px]'
          : 'flex-row'
      }`}
    >
      {participants.map((p) => {
        const isJudge = p.role === 'judge';

        return (
          <div
            key={p.id}
            onClick={() => onParticipantClick && onParticipantClick(p)}
            className={`relative rounded-xl border p-2.5 flex flex-col justify-between shrink-0 transition-all select-none cursor-pointer ${
              orientation === 'vertical' ? 'w-full' : 'w-44 md:w-52 h-32 md:h-36'
            } ${
              isJudge
                ? 'bg-[#222B24] border-[#38473B] hover:border-[#83A58E]'
                : 'bg-[#1C231E] border-[#2D3830] hover:border-[#83A58E]/60'
            }`}
          >
            {/* Top row: Role Badge & Mic status */}
            <div className="flex items-center justify-between z-10">
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                  isJudge
                    ? 'bg-[#324535] text-[#D8E6DC] border border-[#445E49]'
                    : 'bg-[#242E27] text-[#9FB1A3] border border-[#2D3A30]'
                }`}
              >
                {isJudge && <Award className="w-2.5 h-2.5 text-[#83A58E]" />}
                <span>{isJudge ? 'Hội đồng Giám khảo' : 'Thính giả mô phỏng'}</span>
              </span>

              <div className="w-5 h-5 rounded-full bg-[#181F1A]/80 flex items-center justify-center text-[#A8B6AB]">
                {p.isSpeaking ? (
                  <Volume2 className="w-3 h-3 text-[#83A58E] animate-pulse" />
                ) : (
                  <MicOff className="w-3 h-3" />
                )}
              </div>
            </div>

            {/* Middle: Simulated Video Persona Avatar */}
            <div className="flex flex-col items-center justify-center my-auto py-1">
              <div
                style={{ backgroundColor: p.avatarBg }}
                className="w-10 h-10 md:w-11 md:h-11 rounded-full text-white font-bold flex items-center justify-center text-xs md:text-sm shadow-md border-2 border-[#3D4F41] relative"
              >
                {p.avatarInitials}

                {/* Status indicator dot */}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1C231E] ${
                    p.status === 'preparing_question'
                      ? 'bg-[#E8C27B]'
                      : 'bg-[#83A58E]'
                  }`}
                  title={p.statusText}
                />
              </div>

              <p className="text-xs font-semibold text-white mt-1.5 truncate max-w-[150px]">
                {p.name}
              </p>
              <p className="text-[10px] text-[#A8B6AB] truncate max-w-[150px]">
                {p.title.split('·')[0]}
              </p>
            </div>

            {/* Bottom: Simulated Realtime Behavior Status */}
            <div className="bg-[#181F1A]/70 rounded-md px-2 py-1 text-[10px] text-[#A8B6AB] flex items-center gap-1.5 truncate border border-[#2A362D]/60">
              {getStatusIcon(p.status)}
              <span className="truncate">{p.statusText}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
