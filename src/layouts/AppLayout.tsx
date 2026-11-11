/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ActivePage, UserProfile } from '../types';
import { Sidebar } from '../components/common/Sidebar';
import { Header } from '../components/common/Header';
import { MobileNav } from '../components/common/MobileNav';

interface AppLayoutProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  currentUser: UserProfile;
  sessionCount?: number;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activePage,
  onNavigate,
  currentUser,
  sessionCount,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // In full simulated meeting room, we provide a focused immersion view
  const isMeetingRoom = activePage === 'meeting_room';

  const getPageTitle = (page: ActivePage): { title: string; subtitle: string } => {
    switch (page) {
      case 'dashboard':
        return {
          title: 'Tổng quan học tập',
          subtitle: 'Theo dõi tiến độ và bắt đầu buổi thuyết trình mô phỏng',
        };
      case 'practice_setup':
        return {
          title: 'Chuẩn bị phòng luyện tập',
          subtitle: 'Lựa chọn chế độ, chủ đề và cấu hình hội đồng thính giả',
        };
      case 'meeting_room':
        return {
          title: 'Phòng họp mô phỏng',
          subtitle: 'Không gian luyện thuyết trình và phản biện trực tuyến',
        };
      case 'history':
        return {
          title: 'Lịch sử luyện tập',
          subtitle: 'Danh sách các buổi thuyết trình và kết quả đã lưu',
        };
      case 'report':
        return {
          title: 'Báo cáo đánh giá chi tiết',
          subtitle: 'Phân tích nhịp độ nói, từ đệm và nhận xét từ hội đồng',
        };
      case 'classes':
        return {
          title: 'Quản lý lớp học',
          subtitle: 'Danh sách lớp và học sinh giả lập trên trình duyệt này',
        };
      case 'settings':
        return {
          title: 'Cài đặt hệ thống',
          subtitle: 'Tùy chỉnh thông tin học sinh, thiết bị và thông số mô phỏng',
        };
    }
  };

  const { title, subtitle } = getPageTitle(activePage);

  if (isMeetingRoom) {
    return (
      <div className="min-h-screen bg-[#1F2621] text-white flex flex-col antialiased">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F6] flex antialiased">
      {/* Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        sessionCount={sessionCount}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          currentUser={currentUser}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNavigateToSetup={() => onNavigate('practice_setup')}
        />

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
          {children}
        </main>

        {/* Mobile Navigation */}
        <MobileNav activePage={activePage} onNavigate={onNavigate} />
      </div>
    </div>
  );
};
