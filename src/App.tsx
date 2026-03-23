/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { 
  LogOut, 
  BookOpen, 
  FileText, 
  Users, 
  BarChart3, 
  Plus, 
  Upload, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Clock,
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MathRenderer } from './components/MathRenderer';
import { Modal } from './components/Modal';
import { parseExamFromText, parseStudentList } from './services/geminiService';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  orderBy,
  onSnapshot,
  setDoc,
  doc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut as secondarySignOut } from 'firebase/auth';
import { db, secondaryAuth } from './firebase';
import { Exam, Question, Submission, UserProfile } from './types';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const { login, bootstrapAdmin } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (err: any) {
      setError('Email hoặc mật khẩu không đúng');
    }
  };

  const handleBootstrap = async () => {
    setIsBootstrapping(true);
    setError('');
    try {
      await bootstrapAdmin();
      alert('Đã khởi tạo tài khoản Giáo viên thành công!\nEmail: dinhtrong250393@gmail.com\nMật khẩu: Trong215@');
    } catch (err: any) {
      setError(err.message || 'Lỗi khởi tạo');
    } finally {
      setIsBootstrapping(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-100/50 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg relative z-10"
      >
        <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.1)] p-10 border border-white">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-200 rotate-3">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight uppercase whitespace-nowrap">THI THỬ CÙNG THẦY TRỌNG</h1>
            <p className="text-slate-500 mt-3 font-medium">Mỗi ngày một nháy cùng Toán THPT</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="name@school.edu"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Mật khẩu</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5" />
                {error}
              </motion.div>
            )}
            <button 
              type="submit"
              className="btn-primary w-full text-lg py-4"
            >
              Đăng nhập
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center mb-5 font-semibold uppercase tracking-widest">Khởi tạo hệ thống</p>
            <button 
              onClick={handleBootstrap}
              disabled={isBootstrapping}
              className="w-full bg-slate-50 hover:bg-slate-100 text-indigo-600 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 border border-slate-200/50"
            >
              {isBootstrapping ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Khởi tạo tài khoản Giáo viên
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const TeacherDashboard = () => {
  const { profile, logout } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [examText, setExamText] = useState('');
  const [studentText, setStudentText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isCreatingStudents, setIsCreatingStudents] = useState(false);
  const [activeTab, setActiveTab] = useState<'exams' | 'stats'>('exams');
  const [duration, setDuration] = useState('90');

  useEffect(() => {
    const q = query(collection(db, 'exams'), where('teacherId', '==', profile?.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam)));
    });
    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    const q = query(collection(db, 'submissions'), orderBy('submittedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    });
    return unsubscribe;
  }, []);

  const handleUpload = async () => {
    if (!examText.trim()) return;
    setIsParsing(true);
    try {
      const parsed = await parseExamFromText(examText);
      await addDoc(collection(db, 'exams'), {
        ...parsed,
        teacherId: profile?.uid,
        duration: parseInt(duration) || 90,
        createdAt: serverTimestamp()
      });
      setIsUploadModalOpen(false);
      setExamText('');
    } catch (err) {
      alert('Lỗi khi phân tích đề thi bằng AI');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <nav className="glass border-b border-slate-200/50 px-8 py-5 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none uppercase">Thầy Trọng</h1>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-1">Quản trị hệ thống</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsStudentModalOpen(true)}
              className="btn-secondary flex items-center gap-2 px-5 py-2.5"
            >
              <Users className="w-5 h-5" />
              <span className="hidden md:inline">Thêm học sinh</span>
            </button>
            <button 
              onClick={() => setIsUploadModalOpen(true)}
              className="btn-primary flex items-center gap-2 px-5 py-2.5"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden md:inline">Tạo đề thi</span>
            </button>
            <div className="w-px h-8 bg-slate-200 mx-2" />
            <button 
              onClick={logout}
              className="p-3 hover:bg-red-50 rounded-2xl text-slate-400 hover:text-red-500 transition-all"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex gap-2 p-1.5 bg-slate-200/50 rounded-[1.5rem] w-fit">
            <button 
              onClick={() => setActiveTab('exams')}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${activeTab === 'exams' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <FileText className="w-5 h-5" />
              Đề thi
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${activeTab === 'stats' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <BarChart3 className="w-5 h-5" />
              Thống kê
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-500 font-medium bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {exams.length} Đề thi
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {submissions.length} Lượt thi
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'exams' ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {exams.map((exam, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={exam.id}
                  className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
                >
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                      <ClipboardList className="w-7 h-7 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    </div>
                    <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-wider">
                      {exam.questions.length} Câu
                    </div>
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors">{exam.title}</h3>
                  <p className="text-sm font-medium text-slate-400 mb-8">Cập nhật: {exam.createdAt?.toDate().toLocaleDateString('vi-VN')}</p>
                  <button className="w-full py-4 text-slate-600 font-bold bg-slate-50 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all">
                    Quản lý đề thi
                  </button>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-8 py-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Học sinh</th>
                      <th className="px-8 py-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Đề thi</th>
                      <th className="px-8 py-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Điểm số</th>
                      <th className="px-8 py-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Ngày nộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {submissions.map(sub => (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                              {sub.studentName.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-900">{sub.studentName}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-slate-600 font-medium">{sub.examTitle || 'Đề thi'}</td>
                        <td className="px-8 py-6 text-center">
                          <span className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl text-lg font-black ${sub.score >= 8 ? 'bg-emerald-50 text-emerald-600' : sub.score >= 5 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                            {sub.score.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right text-slate-400 font-medium text-sm">
                          {sub.submittedAt?.toDate().toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Modal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        title="Tạo đề thi mới bằng AI"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Thời gian làm bài (phút)</label>
            <input 
              type="number" 
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="90"
            />
          </div>
          <p className="text-sm text-slate-500">Dán nội dung đề thi của bạn vào đây. AI sẽ tự động nhận diện câu hỏi, đáp án và công thức toán học.</p>
          <textarea 
            value={examText}
            onChange={(e) => setExamText(e.target.value)}
            className="w-full h-64 p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
            placeholder="Câu 1: Cho hàm số...
A. ...
B. ...
C. ...
D. ..."
          />
          <button 
            onClick={handleUpload}
            disabled={isParsing || !examText.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {isParsing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang phân tích...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Bắt đầu tạo đề
              </>
            )}
          </button>
        </div>
      </Modal>

      <Modal 
        isOpen={isStudentModalOpen} 
        onClose={() => setIsStudentModalOpen(false)} 
        title="Thêm danh sách học sinh"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Dán danh sách học sinh (Tên, Email, Mật khẩu). AI sẽ tự động tách thông tin và tạo tài khoản.</p>
          <textarea 
            value={studentText}
            onChange={(e) => setStudentText(e.target.value)}
            className="w-full h-48 p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
            placeholder="Nguyễn Văn A, anguyen@gmail.com, 123456
Trần Thị B, btran@gmail.com, abcxyz"
          />
          <button 
            onClick={async () => {
              if (!studentText.trim()) return;
              setIsCreatingStudents(true);
              try {
                const students = await parseStudentList(studentText);
                for (const s of students) {
                  try {
                    const userCred = await createUserWithEmailAndPassword(secondaryAuth, s.email, s.password);
                    await setDoc(doc(db, 'users', userCred.user.uid), {
                      uid: userCred.user.uid,
                      email: s.email,
                      displayName: s.displayName,
                      role: 'student',
                      createdAt: serverTimestamp()
                    });
                    await secondarySignOut(secondaryAuth);
                  } catch (e) {
                    console.error(`Lỗi tạo học sinh ${s.email}:`, e);
                  }
                }
                alert('Đã tạo xong danh sách học sinh!');
                setIsStudentModalOpen(false);
                setStudentText('');
              } catch (err) {
                alert('Lỗi khi xử lý danh sách');
              } finally {
                setIsCreatingStudents(false);
              }
            }}
            disabled={isCreatingStudents || !studentText.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {isCreatingStudents ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang tạo tài khoản...
              </>
            ) : (
              <>
                <Users className="w-5 h-5" />
                Bắt đầu tạo tài khoản
              </>
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
};

const StudentDashboard = () => {
  const { profile, logout } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; wrongIds: string[] } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const handleSubmitExam = async () => {
    if (!selectedExam) return;
    setIsSubmitting(true);
    
    let correctCount = 0;
    const wrongIds: string[] = [];
    
    selectedExam.questions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) {
        correctCount++;
      } else {
        wrongIds.push(q.id);
      }
    });
    
    const score = (correctCount / selectedExam.questions.length) * 10;
    
    try {
      await addDoc(collection(db, 'submissions'), {
        examId: selectedExam.id,
        examTitle: selectedExam.title,
        studentId: profile?.uid,
        studentName: profile?.displayName || profile?.email,
        answers,
        score,
        wrongQuestionIds: wrongIds,
        submittedAt: serverTimestamp()
      });
      setResult({ score, wrongIds });
    } catch (err) {
      alert('Lỗi khi nộp bài');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (selectedExam && !result) {
      setTimeLeft(selectedExam.duration * 60);
      setShowWarning(false);
    } else {
      setTimeLeft(null);
      setShowWarning(false);
    }
  }, [selectedExam, result]);

  useEffect(() => {
    if (timeLeft === null) return;

    if (timeLeft === 300) {
      setShowWarning(true);
    }

    if (timeLeft === 0) {
      handleSubmitExam();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const q = query(collection(db, 'exams'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam)));
    });
    return unsubscribe;
  }, []);

  if (selectedExam) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-sm border border-white sticky top-6 z-20">
            <AnimatePresence>
              {showWarning && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-xl z-50 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  Sắp hết thời gian! Còn lại 5 phút.
                  <button onClick={() => setShowWarning(false)} className="ml-2 hover:opacity-70">×</button>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mb-4 md:mb-0">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedExam.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Học sinh: {profile?.displayName}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {timeLeft !== null && (
                <div className={`flex flex-col items-end px-6 py-3 rounded-2xl border-2 transition-all ${timeLeft < 300 ? 'bg-red-50 border-red-200 animate-pulse' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Thời gian còn lại</p>
                  <p className={`text-2xl font-black tabular-nums ${timeLeft < 300 ? 'text-red-600' : 'text-slate-900'}`}>
                    {formatTime(timeLeft)}
                  </p>
                </div>
              )}
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tiến độ làm bài</p>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(Object.keys(answers).length / selectedExam.questions.length) * 100}%` }}
                      className="h-full bg-indigo-600"
                    />
                  </div>
                  <span className="text-sm font-black text-indigo-600">
                    {Object.keys(answers).length}/{selectedExam.questions.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-10 mb-20">
            {selectedExam.questions.map((q, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                key={q.id} 
                className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-2 h-full bg-slate-50" />
                <div className="flex gap-6 mb-8">
                  <span className="flex-shrink-0 w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-lg shadow-slate-200">
                    {idx + 1}
                  </span>
                  <div className="text-xl font-bold text-slate-800 leading-relaxed pt-1">
                    <MathRenderer content={q.text} />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 ml-0 md:ml-16">
                  {q.options.map((opt, optIdx) => {
                    const label = String.fromCharCode(65 + optIdx);
                    const isSelected = answers[q.id] === label;
                    return (
                      <button
                        key={label}
                        onClick={() => setAnswers(prev => ({ ...prev, [q.id]: label }))}
                        className={`group flex items-center gap-4 p-5 rounded-[1.5rem] border-2 transition-all text-left relative overflow-hidden ${
                          isSelected 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200 scale-[1.02]' 
                            : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 text-slate-700'
                        }`}
                      >
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-colors ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                          {label}
                        </span>
                        <div className="font-bold flex-1">
                          <MathRenderer content={opt} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex gap-4 sticky bottom-8 z-30">
            <button 
              onClick={() => setSelectedExam(null)}
              className="btn-secondary flex-1 py-5 text-lg shadow-xl"
            >
              Thoát
            </button>
            <button 
              onClick={handleSubmitExam}
              disabled={isSubmitting || Object.keys(answers).length < selectedExam.questions.length}
              className="btn-primary flex-[2] py-5 text-lg flex items-center justify-center gap-3 shadow-2xl shadow-indigo-200"
            >
              {isSubmitting ? <Loader2 className="w-7 h-7 animate-spin" /> : <CheckCircle2 className="w-7 h-7" />}
              Nộp bài thi ngay
            </button>
          </div>
        </div>

        <Modal isOpen={!!result} onClose={() => { setResult(null); setSelectedExam(null); setAnswers({}); }} title="Kết quả bài thi">
          <div className="text-center py-10">
            <div className="relative inline-block mb-8">
              <div className="absolute inset-0 bg-indigo-200 rounded-full blur-2xl opacity-50 animate-pulse" />
              <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-2xl shadow-indigo-200">
                <span className="text-5xl font-black text-white">{result?.score.toFixed(1)}</span>
              </div>
            </div>
            <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Hoàn thành bài thi!</h3>
            <p className="text-slate-500 font-bold mb-10 uppercase tracking-widest text-sm">Bạn đã làm sai {result?.wrongIds.length} câu hỏi.</p>
            
            {result?.wrongIds.length! > 0 && (
              <div className="text-left bg-slate-50 p-8 rounded-[2rem] mb-10 border border-slate-100">
                <p className="font-black text-slate-900 mb-4 flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                  Danh sách câu làm sai:
                </p>
                <div className="flex flex-wrap gap-3">
                  {result?.wrongIds.map(id => {
                    const idx = selectedExam.questions.findIndex(q => q.id === id);
                    return (
                      <span key={id} className="bg-white text-red-600 px-4 py-2 rounded-xl font-black shadow-sm border border-red-50">
                        Câu {idx + 1}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-6 pt-6 border-t border-slate-200/50">
                  <p className="text-sm text-slate-400 font-medium italic">
                    * Hệ thống không hiển thị đáp án đúng để khuyến khích bạn tự ôn tập và tìm hiểu lại kiến thức.
                  </p>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => { setResult(null); setSelectedExam(null); setAnswers({}); }}
              className="btn-primary w-full py-5 text-lg"
            >
              Quay lại danh sách đề thi
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <nav className="glass border-b border-slate-200/50 px-8 py-5 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none uppercase">Thầy Trọng</h1>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-1">Trung tâm học tập</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-slate-900">{profile?.displayName}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{profile?.email}</p>
            </div>
            <div className="w-px h-8 bg-slate-200 mx-1" />
            <button 
              onClick={logout}
              className="p-3 hover:bg-red-50 rounded-2xl text-slate-400 hover:text-red-500 transition-all"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8">
        <div className="mb-12">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-3">Sẵn sàng thử thách?</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Chọn một đề thi để bắt đầu rèn luyện kiến thức</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {exams.map((exam, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -8 }}
              key={exam.id}
              className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-150 group-hover:bg-indigo-600" />
              
              <div className="relative z-10">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-white/20 transition-colors">
                  <FileText className="w-8 h-8 text-slate-400 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 group-hover:text-white transition-colors">{exam.title}</h3>
                <div className="flex items-center gap-3 text-slate-400 font-bold uppercase tracking-widest text-xs mb-4 group-hover:text-white/70 transition-colors">
                  <ClipboardList className="w-4 h-4" />
                  {exam.questions.length} Câu hỏi
                </div>
                <div className="flex items-center gap-3 text-slate-400 font-bold uppercase tracking-widest text-xs mb-10 group-hover:text-white/70 transition-colors">
                  <Clock className="w-4 h-4" />
                  {exam.duration} Phút làm bài
                </div>
                <button 
                  onClick={() => setSelectedExam(exam)}
                  className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-white hover:text-indigo-600 text-white font-black py-4 rounded-[1.5rem] transition-all shadow-xl"
                >
                  Bắt đầu ngay
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
};

const MainApp = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) return <Login />;

  return profile?.role === 'teacher' ? <TeacherDashboard /> : <StudentDashboard />;
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
