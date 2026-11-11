/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  User,
  Camera,
  Mic,
  Shield,
  Sliders,
  Info,
  Check,
  Save,
  GraduationCap,
  Sparkles,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { UserProfile } from '../types';
import { Button } from '../components/ui/Button';
import { DemoNotice } from '../components/ui/DemoNotice';
import { GoogleIdentityTest } from '../components/auth/GoogleIdentityTest';

interface SettingsPageProps {
  currentUser: UserProfile;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'devices' | 'ai' | 'privacy' | 'about'>('profile');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [school, setSchool] = useState(currentUser.school);
  const [grade, setGrade] = useState(currentUser.grade);
  const [selectedCamera, setSelectedCamera] = useState('HD Web Camera (Mô phỏng)');
  const [selectedMic, setSelectedMic] = useState('Microphone Array Built-in (Mô phỏng)');
  const [aiStrictness, setAiStrictness] = useState('standard');
  const [language, setLanguage] = useState('vi');

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <DemoNotice
        title="Trang cấu hình hệ thống"
        message="Các thiết lập dưới đây được lưu trong phiên làm việc hiện tại của trình duyệt. Các kết nối phần cứng và tài khoản cơ sở dữ liệu sẽ được triển khai ở các giai đoạn sau."
      />

      <div className="bg-white rounded-2xl border border-[#E4E9E3] shadow-xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="flex border-b border-[#E4E9E3] overflow-x-auto bg-[#F7F9F6] p-1.5 gap-1">
          {[
            { id: 'profile', label: 'Tài khoản học sinh', icon: User },
            { id: 'devices', label: 'Camera & Micro', icon: Camera },
            { id: 'ai', label: 'Mức độ Hội đồng AI', icon: Sliders },
            { id: 'privacy', label: 'Quyền riêng tư', icon: Shield },
            { id: 'about', label: 'Về SpeakLab AI', icon: Info },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#324C3B] shadow-2xs border border-[#E4E9E3]'
                    : 'text-[#768078] hover:text-[#3D4740] hover:bg-white/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#83A58E]' : 'text-[#768078]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6 md:p-8">
          {/* 1. Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[#3D4740]">
                  Thông tin học sinh
                </h3>
                <p className="text-xs text-[#768078] mt-0.5">
                  Dữ liệu định danh dùng để gắn vào báo cáo đánh giá thuyết trình
                </p>
              </div>

              <GoogleIdentityTest />

              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#FAFBF9] border border-[#E4E9E3]">
                <div className="w-14 h-14 rounded-full bg-[#EEF4F0] border-2 border-[#D9E5DC] text-[#324C3B] font-bold text-lg flex items-center justify-center">
                  {currentUser.avatarInitials}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#3D4740]">
                    {currentUser.fullName}
                  </h4>
                  <p className="text-xs text-[#768078]">{currentUser.roleDescription}</p>
                  <span className="inline-block mt-1 text-[10px] text-[#4A6453] bg-[#EEF4F0] px-2 py-0.5 rounded border border-[#D9E5DC]">
                    Tài khoản demo thử nghiệm
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#3D4740] mb-1.5">
                    Họ và tên học sinh
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs md:text-sm rounded-lg border border-[#E4E9E3] focus:ring-2 focus:ring-[#83A58E] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3D4740] mb-1.5">
                    Trường học
                  </label>
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs md:text-sm rounded-lg border border-[#E4E9E3] focus:ring-2 focus:ring-[#83A58E] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3D4740] mb-1.5">
                    Khối lớp
                  </label>
                  <input
                    type="text"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs md:text-sm rounded-lg border border-[#E4E9E3] focus:ring-2 focus:ring-[#83A58E] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3D4740] mb-1.5">
                    Ngôn ngữ giao diện
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs md:text-sm rounded-lg border border-[#E4E9E3] focus:ring-2 focus:ring-[#83A58E] outline-none bg-white"
                  >
                    <option value="vi">Tiếng Việt (Mặc định)</option>
                    <option value="en" disabled>English (Sắp có)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 2. Devices Tab */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[#3D4740]">
                  Cấu hình Camera & Micro
                </h3>
                <p className="text-xs text-[#768078] mt-0.5">
                  Mô phỏng thiết bị thu âm và ghi hình cho phòng họp
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#3D4740] mb-1.5 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-[#83A58E]" />
                    <span>Thiết bị Webcam (Mô phỏng)</span>
                  </label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs md:text-sm rounded-lg border border-[#E4E9E3] focus:ring-2 focus:ring-[#83A58E] outline-none bg-white"
                  >
                    <option value="HD Web Camera (Mô phỏng)">
                      HD Web Camera (1080p · Thiết bị mô phỏng)
                    </option>
                    <option value="Virtual Camera 2">
                      OBS Virtual Camera (Mô phỏng)
                    </option>
                  </select>
                  <p className="text-[11px] text-[#768078] mt-1">
                    Trạng thái: Khung hình placeholder đang hoạt động. Luồng video thật sẽ được kết nối ở Đợt 2.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3D4740] mb-1.5 flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-[#83A58E]" />
                    <span>Thiết bị Microphone (Mô phỏng)</span>
                  </label>
                  <select
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs md:text-sm rounded-lg border border-[#E4E9E3] focus:ring-2 focus:ring-[#83A58E] outline-none bg-white"
                  >
                    <option value="Microphone Array Built-in (Mô phỏng)">
                      Microphone Array Built-in (Khử ồn mô phỏng)
                    </option>
                    <option value="USB Headset Microphone">
                      Tai nghe chống ồn USB (Mô phỏng)
                    </option>
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-[#FAFBF9] border border-[#E4E9E3] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#3D4740]">Kiểm tra âm lượng micro</span>
                    <span className="text-[#5A7D65] font-mono text-[11px]">Bình thường (65dB)</span>
                  </div>
                  <div className="w-full h-2 bg-[#E4E9E3] rounded-full overflow-hidden">
                    <div className="w-2/3 h-full bg-[#83A58E] rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. AI Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[#3D4740]">
                  Mức độ phản biện của Hội đồng AI
                </h3>
                <p className="text-xs text-[#768078] mt-0.5">
                  Tùy biến phong cách chất vấn và độ khó của các giám khảo mô phỏng
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    id: 'gentle',
                    title: 'Khuyến khích & Thân thiện',
                    desc: 'Giám khảo chú ý lắng nghe, gật đầu động viên, câu hỏi nhẹ nhàng gợi mở ý tưởng.',
                  },
                  {
                    id: 'standard',
                    title: 'Tiêu chuẩn Học thuật (Khuyên dùng)',
                    desc: 'Mô phỏng đúng không khí hội đồng chấm đồ án, đặt 1-2 câu hỏi làm rõ phương pháp.',
                  },
                  {
                    id: 'strict',
                    title: 'Phản biện khắt khe & Tình huống áp lực',
                    desc: 'Hội đồng xoáy sâu vào số liệu chưa chặt chẽ, ngắt lời mô phỏng để rèn luyện tâm lý vững vàng.',
                  },
                ].map((item) => {
                  const isSelected = aiStrictness === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setAiStrictness(item.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#EEF4F0] border-[#83A58E] ring-1 ring-[#83A58E]'
                          : 'bg-white border-[#E4E9E3] hover:bg-[#F7F9F6]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#3D4740]">
                          {item.title}
                        </span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-[#83A58E]" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#768078] mt-1 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Privacy Tab */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[#3D4740]">
                  Quyền riêng tư & Bảo mật dữ liệu
                </h3>
                <p className="text-xs text-[#768078] mt-0.5">
                  Cam kết bảo vệ hình ảnh và dữ liệu luyện tập của học sinh
                </p>
              </div>

              <div className="space-y-3 text-xs text-[#444F47]">
                <div className="p-4 rounded-xl bg-[#FAFBF9] border border-[#E4E9E3] space-y-1.5">
                  <h4 className="font-bold text-[#3D4740] flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-[#83A58E]" />
                    Xử lý cục bộ tại thiết bị (Edge Processing)
                  </h4>
                  <p className="text-[#768078] text-[11px] leading-relaxed">
                    Ở Đợt 1, toàn bộ dữ liệu chỉ tồn tại trên trình duyệt máy khách. Không có bất kỳ hình ảnh hay giọng nói nào được tải lên máy chủ ngoài.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAFBF9] border border-[#E4E9E3] space-y-1.5">
                  <h4 className="font-bold text-[#3D4740]">
                    Không yêu cầu quyền truy cập cá nhân nhạy cảm
                  </h4>
                  <p className="text-[#768078] text-[11px] leading-relaxed">
                    Hệ thống không thu thập thông tin định danh hay yêu cầu API key từ người dùng.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 5. About Tab */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[#3D4740]">
                  Về dự án SpeakLab AI
                </h3>
                <p className="text-xs text-[#768078] mt-0.5">
                  Hệ thống luyện thuyết trình và phản biện thông minh dành cho học sinh
                </p>
              </div>

              <div className="space-y-4 text-xs text-[#444F47]">
                <div className="p-4 rounded-xl bg-[#EEF4F0] border border-[#D9E5DC] space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#2A4433] text-sm">SpeakLab AI</span>
                    <span className="text-[10px] font-semibold text-white bg-[#83A58E] px-1.5 py-0.2 rounded">
                      Phiên bản Đợt 1
                    </span>
                  </div>
                  <p className="text-[#4A6453] leading-relaxed">
                    Dự án ra đời nhằm giải quyết vấn đề tâm lý e ngại, thiếu tự tin và hạn chế cơ hội tập dượt của học sinh trước các cuộc thi Khoa học Kỹ thuật, hội đồng bảo vệ đồ án và thuyết trình học đường.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#FAFBF9] border border-[#E4E9E3] space-y-1">
                    <h5 className="font-semibold text-[#3D4740]">Kiến trúc công nghệ</h5>
                    <p className="text-[11px] text-[#768078]">
                      React 19, TypeScript, Tailwind CSS v4, Lucide Icons. Kiến trúc module hóa độc lập, sẵn sàng xuất GitHub và tích hợp Capacitor.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAFBF9] border border-[#E4E9E3] space-y-1">
                    <h5 className="font-semibold text-[#3D4740]">Hướng phát triển</h5>
                    <p className="text-[11px] text-[#768078]">
                      Sẵn sàng bổ sung backend API, AI Speech recognition tiếng Việt và Computer Vision ở Đợt 2 & 3.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Save Action */}
          <div className="mt-8 pt-4 border-t border-[#E4E9E3] flex items-center justify-between">
            {saveSuccess ? (
              <span className="text-xs text-[#5A7D65] font-semibold flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-4 h-4" /> Đã lưu cài đặt phiên mô phỏng thành công!
              </span>
            ) : (
              <span className="text-xs text-[#768078]">
                Mọi thay đổi áp dụng tức thì cho phiên trải nghiệm hiện tại.
              </span>
            )}

            <Button
              variant="primary"
              size="md"
              icon={<Save className="w-4 h-4" />}
              onClick={handleSave}
            >
              Lưu thay đổi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
