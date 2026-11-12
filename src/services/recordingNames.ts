import type { RecordingVideoSource } from './presentationRecordingService';

const SOURCE_NAME: Record<RecordingVideoSource, string> = {
  camera: 'Camera + micro',
  screen: 'PowerPoint + micro',
};

/** Visible title for a NEW video only; existing IndexedDB records are untouched. */
export function recordingLibraryTitle(title: string, source: RecordingVideoSource): string {
  const base = title.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  return (base || 'Buổi luyện thuyết trình') + ' · ' + SOURCE_NAME[source];
}

/** Safe and legible local filename with subject, source and timestamp. */
export function recordingDownloadName(
  title: string,
  source: RecordingVideoSource,
  extension: 'webm' | 'mp4',
  date: Date = new Date(),
): string {
  const slug = title.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 52) || 'Buoi_luyen';
  const timestamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-') + '_' +
    [date.getHours(), date.getMinutes(), date.getSeconds()]
      .map(n => String(n).padStart(2, '0')).join('-');
  return `SpeakLab_${source === 'camera' ? 'Camera' : 'PowerPoint'}_${slug}_${timestamp}.${extension}`;
}
