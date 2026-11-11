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
} from 'lucide-react';
import { ActivePage } from '../../types';

interface MobileNavProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activePage, onNavigate }) => {
  const items = [
    { id: 'dashboard' as ActivePage, label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'practice_setup' as ActivePage, label: 'Luyện tập', icon: Presentation },
    { id: 'history' as ActivePage, label: 'Lịch sử', icon: History },
    { id: 'report' as ActivePage, label: 'Báo cáo', icon: FileBarChart },
    { id: 'settings' as ActivePage, label: 'Cài đặt', icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#E4E9E3] z-40 px-2 flex items-center justify-around shadow-sm">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          activePage === item.id ||
          (activePage === 'meeting_room' && item.id === 'practice_setup');

        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors ${
              isActive
                ? 'text-[#2A4433] font-semibold'
                : 'text-[#768078] hover:text-[#3D4740]'
            }`}
          >
            <div
              className={`p-1 rounded-lg ${
                isActive ? 'bg-[#EEF4F0]' : 'bg-transparent'
              }`}
            >
              <Icon
                className={`w-5 h-5 ${
                  isActive ? 'text-[#3D5C46]' : 'text-[#768078]'
                }`}
              />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[64px]">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
