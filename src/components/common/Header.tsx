/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Bell,
  Menu,
  GraduationCap,
  Sparkles,
  ChevronDown,
  User,
  Clock,
  Award
} from 'lucide-react';
import { UserProfile } from '../../types';

interface HeaderProps {
  title: string;
  subtitle?: string;
  currentUser: UserProfile;
  onOpenMobileMenu?: () => void;
  onNavigateToSetup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  currentUser,
  onOpenMobileMenu,
  onNavigateToSetup,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-[#E4E9E3] px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile trigger & Page Title */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 text-[#556057] hover:text-[#3D4740] hover:bg-[#F7F9F6] rounded-lg"
            aria-label="Mở menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base md:text-lg font-bold text-[#3D4740] tracking-tight">
              {title}
            </h1>
            <span className="hidden sm:inline-block text-[11px] font-medium text-[#4A6453] bg-[#EEF4F0] px-2 py-0.5 rounded border border-[#D9E5DC]">
              Bản thử nghiệm Đợt 1
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-[#768078] hidden sm:block -mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions & User Info */}
      <div className="flex items-center gap-2 md:gap-4">
        {onNavigateToSetup && (
          <button
            onClick={onNavigateToSetup}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#83A58E] hover:bg-[#6F917A] text-white shadow-2xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Phòng Luyện Mới</span>
          </button>
        )}

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-[#768078] hover:text-[#3D4740] hover:bg-[#F7F9F6] rounded-lg transition-colors relative cursor-pointer"
            title="Thông báo hệ thống"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#83A58E] rounded-full" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-[#E4E9E3] shadow-lg p-3 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-[#E4E9E3]">
                <span className="text-xs font-semibold text-[#3D4740]">Thông báo hệ thống</span>
                <span className="text-[10px] text-[#768078]">2 mới</span>
              </div>
              <div className="space-y-2 mt-2">
                <div className="p-2 rounded-lg bg-[#F7F9F6] border border-[#E4E9E3]/70 text-xs">
                  <p className="font-medium text-[#3D4740]">Báo cáo đánh giá đã sẵn sàng</p>
                  <p className="text-[11px] text-[#768078] mt-0.5">
                    Buổi luyện "Bảo vệ Đề tài AI Phân loại Rác" đã hoàn tất bản chấm demo.
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-white border border-[#E4E9E3] text-xs">
                  <p className="font-medium text-[#3D4740]">Chào mừng đến SpeakLab AI</p>
                  <p className="text-[11px] text-[#768078] mt-0.5">
                    Hãy thử vào phòng luyện mô phỏng để làm quen với không gian hội đồng.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Capsule */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-[#F7F9F6] transition-colors border border-transparent hover:border-[#E4E9E3] cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-[#EEF4F0] border border-[#D9E5DC] text-[#324C3B] flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser.avatarInitials}
            </div>
            <div className="hidden lg:block text-left pr-1">
              <p className="text-xs font-semibold text-[#3D4740] leading-tight">
                {currentUser.fullName}
              </p>
              <p className="text-[11px] text-[#768078] leading-tight">
                {currentUser.grade}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#768078] hidden sm:block" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-[#E4E9E3] shadow-lg p-3 z-50 animate-in fade-in zoom-in-95">
              <div className="pb-3 border-b border-[#E4E9E3]">
                <p className="text-sm font-semibold text-[#3D4740]">{currentUser.fullName}</p>
                <p className="text-xs text-[#768078]">{currentUser.school}</p>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-[#4A6453] bg-[#EEF4F0] px-2 py-1 rounded border border-[#D9E5DC]">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>{currentUser.roleDescription}</span>
                </div>
              </div>
              <div className="py-2 space-y-1.5 text-xs text-[#556057]">
                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-[#768078]">
                    <Clock className="w-3.5 h-3.5" /> Thời gian luyện
                  </span>
                  <span className="font-medium text-[#3D4740]">
                    {Math.round(currentUser.stats.totalPracticeMinutes / 60)}h{' '}
                    {currentUser.stats.totalPracticeMinutes % 60}m
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-[#768078]">
                    <Award className="w-3.5 h-3.5" /> Mức tiến bộ
                  </span>
                  <span className="font-semibold text-[#4A6453]">
                    +{currentUser.stats.improvementPercentage}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
