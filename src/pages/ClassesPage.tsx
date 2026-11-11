/**
 * Phase 6.9.1A: CLASS MANAGEMENT UI PROTOTYPE ONLY.
 * No authority is derived from Google login yet. Data remains in this browser;
 * NEVER use this roster to authorize Drive reads, uploads or deletes.
 */
import React, { useMemo, useState } from 'react';
import { BookOpen, Plus, Users, UserPlus, Trash2, Search, ShieldAlert, X, CheckCircle2 } from 'lucide-react';
import {
  DemoClass,
  DemoStudent,
  loadDemoRoster,
  saveDemoRoster,
  normalizeRosterText,
  rosterLimits,
} from '../services/demoClassRoster';

const btnPrimary = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#6F917A] hover:bg-[#567561] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnOutline = 'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#D9E5DC] text-[#3D4740] bg-white hover:bg-[#F7F9F6] text-xs font-semibold';
const field = 'w-full px-3 py-2.5 bg-white rounded-lg border border-[#D9E5DC] text-sm text-[#3D4740] focus:outline-none focus:ring-2 focus:ring-[#83A58E]';

const newId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : String(Date.now()) + '-' + Math.random().toString(36).slice(2);

function saveAndReport(next: DemoClass[], update: (classes: DemoClass[]) => void, report: (message: string) => void, success: string) {
  if (!saveDemoRoster(next)) {
    report('Không thể lưu trên trình duyệt này. Kiểm tra chế độ riêng tư hoặc dung lượng bộ nhớ.');
    return false;
  }
  update(next);
  report(success);
  return true;
}

export const ClassesPage: React.FC = () => {
  const [classes, setClasses] = useState<DemoClass[]>(loadDemoRoster);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [className, setClassName] = useState('');
  const [academicYear, setAcademicYear] = useState('2026–2027');
  const [showCreate, setShowCreate] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'class' | 'student'; id: string; label: string } | null>(null);

  const selected = classes.find(c => c.id === selectedId) || classes[0] || null;
  const totalStudents = classes.reduce((sum, item) => sum + item.students.length, 0);
  const students = useMemo(() => {
    if (!selected) return [];
    const q = search.trim().toLocaleLowerCase('vi');
    return selected.students.filter(s => !q || (s.name + ' ' + s.code).toLocaleLowerCase('vi').includes(q));
  }, [selected, search]);

  const select = (id: string) => {
    setSelectedId(id);
    setSearch('');
    setShowAddStudent(false);
    setNotice('');
  };

  const createClass = (event: React.FormEvent) => {
    event.preventDefault();
    const name = normalizeRosterText(className);
    const year = normalizeRosterText(academicYear);
    if (name.length < 2 || name.length > 80 || year.length < 4 || year.length > 20) {
      setNotice('Tên lớp từ 2–80 ký tự và năm học từ 4–20 ký tự.');
      return;
    }
    if (classes.length >= rosterLimits.classes) {
      setNotice('Đã đạt giới hạn lớp thử nghiệm trên thiết bị này.');
      return;
    }
    if (classes.some(c => c.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi') && c.academicYear === year)) {
      setNotice('Lớp này đã có trong cùng năm học.');
      return;
    }
    const item: DemoClass = { id: newId(), name, academicYear: year, createdAt: new Date().toISOString(), students: [] };
    if (saveAndReport([...classes, item], setClasses, setNotice, 'Đã tạo lớp thử nghiệm.')) {
      setSelectedId(item.id);
      setClassName('');
      setShowCreate(false);
    }
  };

  const addStudent = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const name = normalizeRosterText(studentName);
    const code = normalizeRosterText(studentCode);
    if (name.length < 2 || name.length > 100 || code.length < 2 || code.length > 32) {
      setNotice('Tên học sinh từ 2–100 ký tự và mã học sinh từ 2–32 ký tự.');
      return;
    }
    if (selected.students.length >= rosterLimits.studentsPerClass) {
      setNotice('Lớp đã đạt giới hạn học sinh thử nghiệm.');
      return;
    }
    if (selected.students.some(s => s.code.toLocaleLowerCase('vi') === code.toLocaleLowerCase('vi'))) {
      setNotice('Mã học sinh đã tồn tại trong lớp.');
      return;
    }
    const next = classes.map(c => c.id !== selected.id ? c : ({
      ...c,
      students: [...c.students, { id: newId(), name, code, joinedAt: new Date().toISOString() }],
    }));
    if (saveAndReport(next, setClasses, setNotice, 'Đã thêm học sinh thử nghiệm vào lớp.')) {
      setStudentName('');
      setStudentCode('');
      setShowAddStudent(false);
    }
  };

  const confirmDeletion = () => {
    if (!confirm) return;
    if (confirm.kind === 'class') {
      const next = classes.filter(c => c.id !== confirm.id);
      if (saveAndReport(next, setClasses, setNotice, 'Đã xóa lớp và danh sách học sinh cục bộ.')) {
        if (selectedId === confirm.id) setSelectedId(null);
      }
    } else {
      const next = classes.map(c => ({
        ...c, students: c.students.filter(s => s.id !== confirm.id),
      }));
      saveAndReport(next, setClasses, setNotice, 'Đã xóa học sinh khỏi danh sách cục bộ.');
    }
    setConfirm(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <section className="bg-[#FFF9E9] border border-[#EADDB7] rounded-2xl p-4 flex gap-3 items-start">
        <ShieldAlert className="w-5 h-5 text-[#866C36] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-sm text-[#655227]">Bước 6.9.1A · Mẫu quản lý lớp — chưa có phân quyền</p>
          <p className="text-xs text-[#655227] leading-relaxed">
            Chức năng này chỉ dùng để kiểm thử giao diện, mọi người mở Preview đều có thể tạo danh sách trên thiết bị của họ.
            Dữ liệu chỉ lưu trên trình duyệt hiện tại, không đồng bộ giữa các máy và không chứng minh tài khoản đã được giáo viên phê duyệt.
            <strong> Chỉ nhập dữ liệu giả lập, không nhập danh sách hoặc email thật của học sinh.</strong>
          </p>
        </div>
      </section>

      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#3D4740]">Quản lý lớp học</h2>
          <p className="text-xs text-[#768078] mt-1">Tạo lớp, thêm học sinh, tra cứu và quản lý danh sách trong bản thử nghiệm.</p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => {setShowCreate(v => !v); setNotice('');}}>
          <Plus className="w-4 h-4"/> Tạo lớp mới
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-[#E4E9E3] rounded-xl p-4">
          <BookOpen className="w-5 h-5 text-[#6F917A]"/>
          <p className="text-2xl font-bold text-[#3D4740] mt-2">{classes.length}</p>
          <p className="text-xs text-[#768078]">Lớp thử nghiệm</p>
        </div>
        <div className="bg-white border border-[#E4E9E3] rounded-xl p-4">
          <Users className="w-5 h-5 text-[#6F917A]"/>
          <p className="text-2xl font-bold text-[#3D4740] mt-2">{totalStudents}</p>
          <p className="text-xs text-[#768078]">Học sinh giả lập</p>
        </div>
      </div>

      {notice && <p role="status" className="flex gap-2 items-start rounded-lg bg-[#EEF4F0] text-[#3D4740] p-3 text-sm">
        <CheckCircle2 className="w-4 h-4 text-[#52785D] shrink-0 mt-0.5"/>{notice}
      </p>}

      {showCreate && (
        <form onSubmit={createClass} className="bg-white rounded-xl border border-[#D9E5DC] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#3D4740]">Tạo lớp thử nghiệm</h3>
            <button type="button" onClick={() => setShowCreate(false)} aria-label="Đóng tạo lớp"><X className="w-4 h-4"/></button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-[#3D4740] space-y-2">
              <span>Tên lớp</span>
              <input className={field} maxLength={80} required value={className} onChange={e => setClassName(e.target.value)} placeholder="Ví dụ: Lớp Demo 11A1"/>
            </label>
            <label className="text-xs font-semibold text-[#3D4740] space-y-2">
              <span>Năm học</span>
              <input className={field} maxLength={20} required value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2026–2027"/>
            </label>
          </div>
          <button className={btnPrimary} type="submit"><Plus className="w-4 h-4"/> Lưu lớp</button>
        </form>
      )}

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
        <aside className="bg-white border border-[#E4E9E3] rounded-xl overflow-hidden">
          <p className="font-semibold text-sm text-[#3D4740] p-4 border-b border-[#E4E9E3]">Danh sách lớp</p>
          {classes.length === 0 ? (
            <p className="p-5 text-xs text-[#768078]">Chưa có lớp. Chọn “Tạo lớp mới” để bắt đầu.</p>
          ) : (
            <div className="p-2 space-y-1">
              {classes.map(c => (
                <button type="button" key={c.id} onClick={() => select(c.id)}
                  className={'w-full text-left rounded-lg px-3 py-3 border transition-colors ' +
                    (selected?.id === c.id ? 'bg-[#EEF4F0] border-[#D9E5DC]' : 'border-transparent hover:bg-[#F7F9F6]')}>
                  <p className="text-sm font-semibold text-[#3D4740] break-words">{c.name}</p>
                  <p className="text-xs text-[#768078] mt-1">{c.academicYear} · {c.students.length} học sinh</p>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="bg-white border border-[#E4E9E3] rounded-xl min-h-[350px]">
          {!selected ? (
            <div className="p-10 text-center">
              <Users className="w-9 h-9 text-[#83A58E] mx-auto"/>
              <p className="text-sm text-[#768078] mt-3">Hãy tạo một lớp để thêm học sinh giả lập.</p>
            </div>
          ) : (
            <>
              <div className="p-4 md:p-5 border-b border-[#E4E9E3] flex flex-wrap justify-between gap-3 items-center">
                <div>
                  <h3 className="font-bold text-[#3D4740]">{selected.name}</h3>
                  <p className="text-xs text-[#768078] mt-1">Năm học {selected.academicYear} · {selected.students.length} học sinh</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className={btnOutline} onClick={() => {setShowAddStudent(v => !v); setNotice('');}}>
                    <UserPlus className="w-4 h-4"/> Thêm học sinh
                  </button>
                  <button type="button" className={btnOutline + ' text-[#9E3E37]'} title="Xóa lớp" aria-label="Xóa lớp"
                    onClick={() => setConfirm({kind: 'class', id: selected.id, label: selected.name})}>
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>

              {showAddStudent && (
                <form onSubmit={addStudent} className="p-4 md:p-5 bg-[#FAFBF9] border-b border-[#E4E9E3] space-y-3">
                  <h4 className="font-semibold text-sm text-[#3D4740]">Thêm học sinh giả lập</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    <label className="text-xs font-semibold text-[#3D4740] space-y-2">
                      <span>Họ và tên giả lập</span>
                      <input className={field} maxLength={100} required value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Ví dụ: Học sinh Mẫu A"/>
                    </label>
                    <label className="text-xs font-semibold text-[#3D4740] space-y-2">
                      <span>Mã học sinh giả lập</span>
                      <input className={field} maxLength={32} required value={studentCode} onChange={e => setStudentCode(e.target.value)} placeholder="Ví dụ: DEMO001"/>
                    </label>
                  </div>
                  <button type="submit" className={btnPrimary}><UserPlus className="w-4 h-4"/> Lưu học sinh</button>
                </form>
              )}

              <div className="p-4 md:p-5 space-y-4">
                <label className="relative block">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-[#768078]"/>
                  <input className={field + ' pl-9'} value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Tìm theo tên hoặc mã học sinh" aria-label="Tìm học sinh"/>
                </label>
                {students.length === 0 ? (
                  <p className="text-center text-sm text-[#768078] py-10">
                    {selected.students.length === 0 ? 'Chưa có học sinh trong lớp này.' : 'Không tìm thấy học sinh phù hợp.'}
                  </p>
                ) : (
                  <div className="divide-y divide-[#E4E9E3]">
                    {students.map((student: DemoStudent) => (
                      <div key={student.id} className="flex gap-3 items-center justify-between py-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-[#3D4740] break-words">{student.name}</p>
                          <p className="text-xs text-[#768078] mt-1">Mã giả lập: {student.code}</p>
                        </div>
                        <button type="button" className={btnOutline + ' text-[#9E3E37] shrink-0'}
                          aria-label={'Xóa ' + student.name} title="Xóa học sinh"
                          onClick={() => setConfirm({kind: 'student', id: student.id, label: student.name})}>
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {confirm && (
        <div role="presentation" className="fixed inset-0 z-[60] bg-[#1F2621]/60 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-roster-title"
            className="bg-white rounded-xl p-5 w-full max-w-md shadow-xl space-y-4">
            <h3 id="delete-roster-title" className="font-bold text-[#3D4740]">
              {confirm.kind === 'class' ? 'Xóa lớp thử nghiệm?' : 'Xóa học sinh khỏi lớp?'}
            </h3>
            <p className="text-sm text-[#556057]">
              Xóa “{confirm.label}” khỏi bộ nhớ cục bộ trên trình duyệt này.
              {confirm.kind === 'class' && ' Danh sách học sinh trong lớp cũng sẽ bị xóa.'}
              {' '}Thao tác không xóa video hoặc dữ liệu trên Google Drive.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className={btnOutline} onClick={() => setConfirm(null)}>Hủy</button>
              <button type="button" className={btnPrimary + ' !bg-[#9E3E37] hover:!bg-[#81302B]'}
                onClick={confirmDeletion}>Xác nhận xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
