/**
 * Local-only class roster prototype for Phase 6.9.1A.
 * This is NOT an enrollment database or access-control system. Use fictional
 * student names only until teacher authorization and server-side storage exist.
 */
export interface DemoStudent {
  id: string;
  name: string;
  code: string;
  joinedAt: string;
}
export interface DemoClass {
  id: string;
  name: string;
  academicYear: string;
  createdAt: string;
  students: DemoStudent[];
}
export type DemoRoster = DemoClass[];

const KEY = 'speaklab-demo-roster-v1';
const MAX_CLASSES = 30;
const MAX_STUDENTS = 70;

export function loadDemoRoster(): DemoRoster {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > MAX_CLASSES) return [];
    return parsed.filter((item): item is DemoClass =>
      typeof item === 'object' && item !== null &&
      typeof item.id === 'string' && typeof item.name === 'string' &&
      typeof item.academicYear === 'string' &&
      Array.isArray(item.students) && item.students.length <= MAX_STUDENTS &&
      item.students.every((student: unknown) =>
        typeof student === 'object' && student !== null &&
        typeof (student as DemoStudent).id === 'string' &&
        typeof (student as DemoStudent).name === 'string' &&
        typeof (student as DemoStudent).code === 'string' &&
        typeof (student as DemoStudent).joinedAt === 'string'
      )
    );
  } catch {
    return [];
  }
}

export function saveDemoRoster(classes: DemoRoster): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(classes));
    return true;
  } catch {
    return false;
  }
}

export const rosterLimits = { classes: MAX_CLASSES, studentsPerClass: MAX_STUDENTS };
export const normalizeRosterText = (value: string) => value.trim().replace(/\s+/g, ' ');
