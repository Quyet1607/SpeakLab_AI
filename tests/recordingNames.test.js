import { describe, expect, test } from 'bun:test';
import { recordingDownloadName, recordingLibraryTitle, libraryVideoDownloadName } from '../src/services/recordingNames.ts';

describe('student-friendly recording names', () => {
  test('labels new recordings by camera vs PowerPoint without changing old entries', () => {
    expect(recordingLibraryTitle('Đề tài Rác Thông minh', 'camera'))
      .toBe('Đề tài Rác Thông minh · Camera + micro');
    expect(recordingLibraryTitle('Đề tài Rác Thông minh', 'screen'))
      .toBe('Đề tài Rác Thông minh · PowerPoint + micro');
    expect(recordingLibraryTitle('  ', 'camera'))
      .toBe('Buổi luyện thuyết trình · Camera + micro');
  });

  test('creates safe readable timestamped download filenames', () => {
    const d = new Date(2026, 10, 12, 14, 2, 7);
    const cameraName = recordingDownloadName('Bảo vệ: Phân loại rác bằng AI', 'camera', 'webm', d);
    expect(cameraName).toBe('SpeakLab_Camera_Bao_ve_Phan_loai_rac_bang_AI_2026-11-12_14-02-07.webm');
    expect(recordingDownloadName('Thuyết trình PPT', 'screen', 'mp4', d))
      .toBe('SpeakLab_PowerPoint_Thuyet_trinh_PPT_2026-11-12_14-02-07.mp4');
  });

  test('names legacy and imported video downloads without guessing their sources', () => {
    const name = libraryVideoDownloadName('Bài luyện cá nhân', 'webm', '2026-11-12T04:20:00.000Z');
    expect(name.startsWith('SpeakLab_Video_Bai_luyen_ca_nhan_')).toBe(true);
    expect(name.endsWith('.webm')).toBe(true);
    expect(libraryVideoDownloadName('...', 'mp4', 'invalid').startsWith('SpeakLab_Video_Buoi_luyen_')).toBe(true);
  });

  test('never injects directory separators or blank filename', () => {
    const name = recordingDownloadName('../../<script>\\' + 'bad', 'camera', 'webm', new Date(2026, 0, 2));
    expect(name.startsWith('SpeakLab_Camera_')).toBe(true);
    expect(name.includes('/')).toBe(false);
    expect(name.includes('\\')).toBe(false);
    expect(name.endsWith('.webm')).toBe(true);
  });
});
