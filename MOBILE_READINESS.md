# SPEAKLAB AI – MOBILE READINESS & ARCHITECTURE SPECIFICATION (ĐỢT 2.4)

Tài liệu kỹ thuật đánh giá mức độ sẵn sàng cho nền tảng di động (Mobile Web, Capacitor, Android & iOS Native Wrapper) của dự án **SpeakLab AI – Hệ thống luyện thuyết trình và phản biện thông minh**.

---

## 1. NHỮNG CHỨC NĂNG SẴN SÀNG 100% TRÊN MOBILE WEB

Hệ thống hiện tại đã được tối ưu hóa responsive hoàn chỉnh cho các tỷ lệ màn hình điện thoại phổ biến (360×800, 390×844, 412×915, 844×390 ngang, 768×1024 tablet):

| Thành phần | Mức độ hỗ trợ trên Mobile Web | Chi tiết kỹ thuật |
| :--- | :---: | :--- |
| **Giao diện Dashboard & Navigation** | Sẵn sàng 100% | Thanh điều hướng linh hoạt, thẻ thống kê co giãn tự nhiên, không tràn viền. |
| **Trang chuẩn bị phòng luyện (`PracticeSetupPage`)** | Sẵn sàng 100% | Chọn 3 chế độ luyện tập, đổi thời lượng, chỉnh quy mô thính giả (3-15 người), chọn slide mẫu hoặc tệp PPTX từ bộ nhớ điện thoại. |
| **Tải & Quản lý PPTX thật (`PptxUploader` & `pptxSessionStore`)** | Sẵn sàng 100% | Tải tệp `.pptx` qua File Input của điện thoại, kiểm tra Open XML qua `jszip`, lưu giữ trong bộ nhớ phiên (RAM) không cần upload lại khi điều hướng. |
| **Trình chiếu slide "Vừa khung" 2 trục** | Sẵn sàng 100% | Thuật toán tỷ lệ `Math.min(availW / nativeW, availH / nativeH)` tự động co giãn theo viewport thực tế của điện thoại, không cần cuộn dọc/ngang để xem hết slide. |
| **Chế độ "Cuộn đọc" slide** | Sẵn sàng 100% | Cuộn chạm tự nhiên, tách biệt hoàn toàn giữa cử chỉ cuộn nội dung và nút bấm chuyển slide (không vô tình nhảy slide khi cuộn). |
| **Xoay màn hình Điện thoại Dọc/Ngang (Orientation)** | Sẵn sàng 100% | `ResizeObserver` kết hợp lắng nghe sự kiện `resize` & `orientationchange` tự tính lại tỷ lệ trong 1 frame mà **không re-parse PPTX**, không tải lại tệp, giữ nguyên slide hiện tại. |
| **Thanh điều khiển Dock & Drawers** | Sẵn sàng 100% | Vùng chạm tối thiểu 40–44px, danh sách người tham dự và kịch bản người nói hiển thị dạng overlay nổi không ép co cụm vùng chiếu slide. |
| **Hội đồng & Giám khảo ảo** | Sẵn sàng 100% | Chuyển đổi tab nhanh trên mobile (`Slide`, `Hội đồng`, `Camera`), đặt câu hỏi phản biện mô phỏng với thông báo trượt mượt mà. |
| **Báo cáo đánh giá & Lịch sử** | Sẵn sàng 100% | Biểu đồ nhịp độ nói, bảng phân tích từ đệm, dòng thời gian sự kiện hiển thị trực quan trên màn hình nhỏ. |

---

## 2. NHỮNG THÀNH PHẦN TÁI SỬ DỤNG 100% KHI ĐÓNG GÓI APP (CAPACITOR / WEBVIEW)

Khi chuyển sang ứng dụng mobile bằng **Capacitor** hoặc **React Native WebView**, toàn bộ các khối mã nguồn sau được tái sử dụng trực tiếp mà không cần viết lại:

1. **Toàn bộ giao diện người dùng React + Tailwind CSS**:
   - Kiến trúc module hóa sạch sẽ: `src/components/ui/`, `src/features/meeting/`, `src/features/presentation/`, `src/pages/`.
   - Bảng màu xanh Sage chuẩn (`#83A58E`, `#324C3B`, `#2A4433`, `#181F1A`, `#E4E9E3`, `#3D4740`).
2. **Bộ máy giải mã Open XML và dựng SVG nội bộ**:
   - `src/services/pptxService.ts` sử dụng `jszip` và `@web-ppt/core`, hoạt động hoàn toàn ở client, không phụ thuộc server hay node runtime riêng.
3. **Quản lý trạng thái và phiên luyện tập**:
   - `src/services/sessionService.ts`, `src/services/reportService.ts`, `pptxSessionStore`.
4. **Kiến trúc dịch vụ chia sẻ màn hình**:
   - `src/services/screenShareService.ts` đã được thiết kế sẵn theo mẫu Adapter Provider (`BrowserScreenShareProvider`, `AndroidNativeScreenShareProvider`, `IOSNativeScreenShareProvider`).

---

## 3. NHỮNG CHỨC NĂNG CẦN XỬ LÝ BẰNG PLUGIN NATIVE

| Tính năng | Trên Mobile Web | Giải pháp Native khi đóng gói App |
| :--- | :--- | :--- |
| **Chia sẻ toàn bộ màn hình hệ thống (Screen Capture)** | Trình duyệt di động bị chặn do bảo mật sandbox của OS. | **Android**: Sử dụng `MediaProjection API` + `Foreground Service` thông qua plugin Capacitor tuỳ biến.<br>**iOS**: Sử dụng `ReplayKit` kết hợp `Broadcast Upload Extension`. |
| **Thu âm Micro & Đo kiểm giọng nói nền** | Có thể dùng `getUserMedia` trên Web nhưng hay bị gián đoạn khi app chạy nền/khoá màn hình. | Plugin Audio Recording Native (Android `AudioRecord`, iOS `AVAudioEngine`) giúp duy trì thu âm ổn định và đo decibel thời gian thực. |
| **Webcam học sinh & Nhận diện cử chỉ** | HTML5 Camera API chạy được nhưng tốn pin trên trình duyệt. | Native Camera Preview Plugin tối ưu hóa GPU và chạy mô hình phân tích thị giác (MediaPipe / TensorFlow Lite) trực tiếp trên NPU điện thoại. |
| **Lưu trữ tài liệu và video ngoại tuyến** | Bị giới hạn quota dung lượng của IndexedDB/CacheStorage. | Native File System Plugin lưu trữ an toàn trong thư mục riêng của app (`DocumentsDirectory`). |

---

## 4. HẠN CHẾ CỦA TRÌNH DUYỆT DI ĐỘNG HIỆN NAY

1. **Hạn chế API `getDisplayMedia`**:
   - Safari trên iOS không hỗ trợ `navigator.mediaDevices.getDisplayMedia` để quay lại cửa sổ khác.
   - Chrome trên Android bị giới hạn nghiêm ngặt theo chính sách bảo mật hệ thống; không thể chọn một ứng dụng khác như PowerPoint nếu không có quyền hệ điều hành.
2. **Chính sách Iframe**:
   - Trong các môi trường nhúng (iframe preview), trình duyệt chặn chính sách `display-capture`.
3. **Quản lý RAM khi mở slide PPTX lớn**:
   - Trình duyệt di động tự động giải phóng tab nếu trang tiêu tốn quá nhiều bộ nhớ (trên 1GB). Hệ thống SpeakLab AI đã tối ưu bộ nhớ bằng cách giải phóng blob URL và dựng SVG theo trang slide đang xem.

---

## 5. HƯỚNG DẪN CÁC BƯỚC ĐÓNG GÓI THÀNH ỨNG DỤNG ANDROID VÀ IOS VỚI CAPACITOR

Khi dự án bước sang giai đoạn đóng gói Native, quy trình thực hiện theo các bước chuẩn:

### Bước 1: Cài đặt Capacitor vào dự án hiện tại
```bash
npm install @capacitor/core @capacitor/cli
npx cap init "SpeakLab AI" "vn.speaklab.ai" --web-dir dist
```

### Bước 2: Biên dịch bản build web sản phẩm
```bash
npm run build
```

### Bước 3: Thêm nền tảng Android và iOS
```bash
npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios
```

### Bước 4: Tích hợp Provider Native cho ScreenShareService
Trong `src/services/screenShareService.ts`:
- Kết nối `AndroidNativeScreenShareProvider` với plugin Capacitor Screen Capture (sử dụng Android `MediaProjectionManager`).
- Kết nối `IOSNativeScreenShareProvider` với ReplayKit Broadcast Extension.

### Bước 5: Cấu hình quyền trong AndroidManifest và Info.plist
- **Android (`AndroidManifest.xml`)**:
  ```xml
  <uses-permission android:name="android.permission.RECORD_AUDIO" />
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
  ```
- **iOS (`Info.plist`)**:
  ```xml
  <key>NSCameraUsageDescription</key>
  <string>SpeakLab AI cần quyền Camera để phân tích hướng nhìn khi thuyết trình.</string>
  <key>NSMicrophoneUsageDescription</key>
  <string>SpeakLab AI cần quyền Micro để đo tốc độ nói và phân tích từ đệm.</string>
  ```

### Bước 6: Đồng bộ và mở trong Android Studio / Xcode
```bash
npx cap sync
npx cap open android  # Mở Android Studio để build APK / AAB
npx cap open ios      # Mở Xcode để build IPA
```
