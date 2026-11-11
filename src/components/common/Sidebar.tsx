/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  Presentation,
  History,
  FileBarChart,
  Settings,
  UsersRound,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck,
  X
} from 'lucide-react';
import { ActivePage } from '../../types';

interface SidebarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  sessionCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  sessionCount = 6,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'dashboard' as ActivePage,
      label: 'Tổng quan',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      id: 'practice_setup' as ActivePage,
      label: 'Phòng luyện tập',
      icon: Presentation,
      badge: 'Chính',
    },
    {
      id: 'history' as ActivePage,
      label: 'Lịch sử luyện tập',
      icon: History,
      badge: `${sessionCount} buổi`,
    },
    {
      id: 'report' as ActivePage,
      label: 'Báo cáo đánh giá',
      icon: FileBarChart,
      badge: 'Demo',
    },
    {
      id: 'classes' as ActivePage,
      label: 'Quản lý lớp',
      icon: UsersRound,
      badge: 'Demo',
    },
    {
      id: 'settings' as ActivePage,
      label: 'Cài đặt',
      icon: Settings,
      badge: undefined,
    },
  ];

  const handleNavClick = (page: ActivePage) => {
    onNavigate(page);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#E4E9E3]">
      {/* Brand Logo Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-[#E4E9E3]">
        <div
          onClick={() => handleNavClick('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#83A58E] text-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
            <Presentation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-[#3D4740]">
                SpeakLab
              </span>
              <span className="text-[11px] font-semibold text-white bg-[#83A58E] px-1.5 py-0.2 rounded">
                AI
              </span>
            </div>
            <p className="text-[10px] text-[#768078] tracking-tight leading-none mt-0.5">
              Luyện thuyết trình & Phản biện
            </p>
          </div>
        </div>

        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-[#768078] hover:text-[#3D4740] hover:bg-[#F7F9F6]"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation List */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#768078] mb-2">
          Điều hướng chính
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activePage === item.id ||
            (activePage === 'meeting_room' && item.id === 'practice_setup');

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group cursor-pointer ${
                isActive
                  ? 'bg-[#EEF4F0] text-[#2A4433] font-semibold shadow-2xs border border-[#D9E5DC]'
                  : 'text-[#556057] hover:bg-[#F7F9F6] hover:text-[#3D4740]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive
                      ? 'text-[#4A6954]'
                      : 'text-[#768078] group-hover:text-[#3D4740]'
                  }`}
                />
                <span className="text-left">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    isActive
                      ? 'bg-[#83A58E] text-white'
                      : 'bg-[#F2F5F2] text-[#768078] group-hover:bg-[#E4E9E3]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Practice Quick CTA Card */}
      <div className="p-3 border-t border-[#E4E9E3]">
        <div className="p-3.5 rounded-xl bg-[#F7F9F6] border border-[#E4E9E3] space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3D4740]">
            <Sparkles className="w-3.5 h-3.5 text-[#83A58E]" />
            <span>Phòng Luyện Hội Đồng</span>
          </div>
          <p className="text-[11px] text-[#768078] leading-relaxed">
            Mô phỏng hội đồng phản biện 3 giám khảo chấm điểm trực tiếp theo kịch bản.
          </p>
          <button
            onClick={() => handleNavClick('practice_setup')}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-lg bg-[#83A58E] hover:bg-[#6F917A] text-white transition-colors cursor-pointer shadow-2xs"
          >
            <span>Vào phòng ngay</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Footer info */}
        <div className="mt-3 px-2 flex items-center justify-between text-[11px] text-[#768078]">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#83A58E]" />
            Bản quyền SpeakLab 2026
          </span>
          <span className="font-mono text-[10px]">v1.0-alpha</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 shrink-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-[#2A332C]/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[80vw] h-full z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
