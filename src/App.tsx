/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { BookOpen, Send, Loader2, Info, CheckCircle2, History, Trash2, FileUp, FileText, X, Image as ImageIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type SolveMode = 'FULL' | 'EXAM' | 'SHORT';

interface FileData {
  base64: string;
  mimeType: string;
  name: string;
}

interface PastSolution {
  problem: string;
  solution: string;
  timestamp: string;
}

export default function App() {
  const [problem, setProblem] = useState('');
  const [mode, setMode] = useState<SolveMode>('FULL');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<PastSolution[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Chỉ hỗ trợ file Ảnh (JPG, PNG) và PDF.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      setSelectedFile({
        base64,
        mimeType: file.type,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSolve = async () => {
    if (!problem.trim() && !selectedFile) return;

    setLoading(true);
    setResult('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const systemInstruction = `
Bạn là giáo viên toán THCS/THPT tại Việt Nam, có kinh nghiệm giảng dạy và trình bày bài giải theo chuẩn sách giáo khoa (SGK).

🎯 MỤC TIÊU:
Giải bài toán một cách:
- Chính xác tuyệt đối
- Logic chặt chẽ
- Trình bày rõ ràng, dễ hiểu cho học sinh

📌 YÊU CẦU TRÌNH BÀY (BẮT BUỘC):
1. TÓM TẮT ĐỀ BÀI: Viết lại ngắn gọn, rõ ràng, chuẩn hóa ký hiệu.
2. PHÂN TÍCH: Xác định dạng toán. Nêu hướng giải.
3. LỜI GIẢI CHI TIẾT: Trình bày từng bước theo SGK. Mỗi bước phải có lý do. Không nhảy bước.
4. KẾT LUẬN: Đưa ra đáp án cuối cùng. Ghi rõ điều kiện (nếu có).

📐 QUY TẮC VIẾT CÔNG THỨC:
- TẤT CẢ công thức toán phải viết bằng LaTeX.
- Dùng:
  + Inline: $...$
  + Xuống dòng: $$...$$
- KHÔNG viết công thức dạng text.
- Ví dụ: $$ x^2 - 5x + 6 = 0 $$

🧠 QUY TẮC SUY LUẬN:
- Sử dụng kiến thức phù hợp trình độ học sinh (ưu tiên lớp 9 nếu không nói rõ).
- Nếu đề bài là từ ảnh/PDF và có lỗi, hãy tự sửa lỗi hợp lý và ghi rõ giả định.
- Nếu có file đính kèm, hãy ưu tiên nội dung trong file để giải.
- QUAN TRỌNG: Nếu trong file đính kèm (ảnh hoặc PDF) chứa NHIỀU bài tập/câu hỏi khác nhau, bạn PHẢI giải TẤT CẢ các câu hỏi đó một cách hệ thống. PHẢI GIỮ NGUYÊN TÊN GỌI (Câu, Bài) và THỨ TỰ của đề bài như trong file gốc (không được tự ý thay thế "Câu" thành "Bài" hoặc ngược lại). Tuyệt đối không được bỏ sót bất kỳ phần nào.

⚙️ CHẾ ĐỘ GIẢI (${mode}):
- FULL: Giải cực kỳ chi tiết, giải thích mọi khía cạnh.
- EXAM: Trình bày như bài thi (ngắn gọn, đủ ý, chuẩn mực).
- SHORT: Chỉ đưa ra đáp án và các bước chính yếu nhất.

📄 ĐỊNH DẠNG ĐẦU RA:
- Văn bản sạch, không dùng ký tự lạ hay emoji thừa.
- Giữ nguyên LaTeX để tương thích với MathType.
`;

      const contents: any[] = [];
      
      if (selectedFile) {
        contents.push({
          inlineData: {
            data: selectedFile.base64,
            mimeType: selectedFile.mimeType
          }
        });
      }

      contents.push({
        text: `[MODE: ${mode}]\n[USER REQUEST]: ${problem || 'Hãy giải bài toán trong file đính kèm'}`
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: { parts: contents },
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2,
        },
      });

      const solution = response.text || "Xin lỗi, tôi không thể tìm thấy lời giải.";
      setResult(solution);
      
      const historyProblem = problem 
        ? (problem.length > 50 ? problem.substring(0, 50) + '...' : problem)
        : (selectedFile ? `File: ${selectedFile.name}` : "Bài toán không tên");

      setHistory(prev => [{
        problem: historyProblem,
        solution: solution,
        timestamp: new Date().toLocaleTimeString('vi-VN')
      }, ...prev].slice(0, 5));

    } catch (error) {
      console.error("Error solving problem:", error);
      setResult("### ❌ Lỗi\nĐã có lỗi xảy ra trong quá trình xử lý. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => setHistory([]);

  return (
    <div className="min-h-screen p-4 lg:p-10 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col gap-5">
        
        {/* Row 1: Header & Status */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <header className="lg:col-span-9 bento-card bento-card-header overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="bg-bento-accent p-3 rounded-none border-[1.5px] border-bento-ink text-bento-ink">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-xl leading-tight uppercase tracking-tight">Gia Sư Toán Học AI</h1>
                <p className="text-[10px] opacity-70 uppercase tracking-widest font-black">Giáo viên chuẩn sách giáo khoa (SGK)</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-white/10 p-1 rounded-none border border-white/20">
              {(['FULL', 'EXAM', 'SHORT'] as SolveMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-4 py-1.5 text-[10px] font-black rounded-none transition-all uppercase tracking-widest",
                    mode === m 
                      ? "bg-bento-accent text-bento-ink" 
                      : "text-white/60 hover:text-white"
                  )}
                >
                  {m === 'FULL' ? 'Chi tiết' : m === 'EXAM' ? 'Bài thi' : 'Rút gọn'}
                </button>
              ))}
            </div>
          </header>

          <aside className="lg:col-span-3 bento-card bento-card-accent justify-center items-center text-center">
            <h2 className="font-black text-2xl uppercase tracking-tighter">Lớp 9 / HKII</h2>
            <p className="text-[10px] font-bold opacity-60 uppercase">Chương Trình GDPT</p>
          </aside>
        </div>

        {/* Row 2: Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Column: Input & History */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            {/* Input Card */}
            <section className="bento-card flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className="bento-label">1. Nhập Đề Bài</span>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 border-[1.5px] border-bento-ink bg-white hover:bg-gray-50 transition-colors"
                    title="Tải lên Ảnh hoặc PDF"
                  >
                    <FileUp className="w-3 h-3" />
                  </button>
                  <div className="sm:hidden">
                    <select 
                      value={mode} 
                      onChange={(e) => setMode(e.target.value as SolveMode)}
                      className="text-[10px] font-black border-2 border-bento-ink bg-bento-accent px-2 py-1 outline-none"
                    >
                      <option value="FULL">CHI TIẾT</option>
                      <option value="EXAM">BÀI THI</option>
                      <option value="SHORT">RÚT GỌN</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {selectedFile && (
                <div className="mb-4 p-2 bg-bento-accent/20 border-2 border-bento-ink border-dashed flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {selectedFile.mimeType.startsWith('image/') ? (
                      <ImageIcon className="w-4 h-4 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 shrink-0" />
                    )}
                    <span className="text-[10px] font-bold truncate italic">{selectedFile.name}</span>
                  </div>
                  <button onClick={removeFile} className="p-1 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder={selectedFile ? "Bạn có thể nhập thêm ghi chú cho file..." : "Ví dụ: Cho Parabol (P): y = x²... hoặc Tải lên Ảnh/PDF bên trên"}
                className="w-full flex-1 min-h-[200px] resize-none border-none focus:ring-0 text-sm font-mono leading-relaxed placeholder:opacity-40"
              />
              <div className="mt-6">
                <button
                  onClick={handleSolve}
                  disabled={loading || (!problem.trim() && !selectedFile)}
                  className={cn(
                    "w-full py-4 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all border-[1.5px] border-bento-ink",
                    loading || (!problem.trim() && !selectedFile)
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed grayscale"
                      : "bg-bento-accent text-bento-ink shadow-[4px_4px_0px_#1A1A1A] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#1A1A1A] active:translate-x-[0px] active:translate-y-[0px] active:shadow-[2px_2px_0px_#1A1A1A]"
                  )}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {loading ? "Đang giải..." : "Bắt Đầu Giải Toán"}
                </button>
              </div>
            </section>

            {/* History Card (Sidebar Card) */}
            <section className="bento-card border-dashed border-gray-400 bg-gray-50/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="bento-label">Kiểm tra & Lịch sử</h3>
                {history.length > 0 && (
                  <button onClick={clearHistory} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              {history.length === 0 ? (
                <div className="py-2 space-y-3">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400">
                    <div className="w-3 h-3 border border-bento-ink" />
                    <span>Dữ liệu: OCR-Cleaned</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400">
                    <div className="w-3 h-3 border border-bento-ink" />
                    <span>Hệ thống: MathType Compatible</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                  {history.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setProblem(item.problem.replace('...', ''));
                        setResult(item.solution);
                      }}
                      className="w-full text-left p-3 border border-bento-ink hover:bg-bento-accent transition-colors flex items-center justify-between group"
                    >
                      <p className="text-[10px] font-bold truncate pr-2">{item.problem}</p>
                      <span className="text-[9px] opacity-40 shrink-0">{item.timestamp}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Result Area */}
          <div className="lg:col-span-8 flex flex-col gap-5">
            {/* Main Solution Card */}
            <section className={cn(
              "bento-card min-h-[500px] flex-1 relative overflow-hidden",
              !result && "justify-center items-center text-center bg-gray-50/30"
            )}>
              <div className="absolute top-0 left-0 right-0 p-5 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur z-10 sticky">
                <span className="bento-label m-0">3. Lời Giải Chi Tiết</span>
                {result && (
                  <button 
                    onClick={() => navigator.clipboard.writeText(result)}
                    className="text-[9px] font-black border-[1.5px] border-bento-ink px-3 py-1 hover:bg-bento-accent transition-colors uppercase tracking-widest"
                  >
                    Sao Chép MathType
                  </button>
                )}
              </div>
              
              <div className="p-2 lg:p-4 mt-12 bg-white">
                {!result && !loading && (
                  <div className="py-20">
                    <div className="w-20 h-20 bg-gray-100 border-[1.5px] border-bento-ink mx-auto flex items-center justify-center mb-6 rotate-3">
                      <BookOpen className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="font-serif italic text-2xl text-gray-400">Chờ đề bài của bạn...</h3>
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mt-4">
                      Vui lòng nhập bài toán để nhận lời giải chuẩn SGK.
                    </p>
                  </div>
                )}
                
                {loading && (
                  <div className="py-20">
                    <div className="relative w-16 h-16 mx-auto mb-6">
                      <Loader2 className="absolute inset-0 w-full h-full text-bento-ink animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 bg-bento-accent border-2 border-bento-ink" />
                      </div>
                    </div>
                    <p className="font-serif italic text-xl animate-pulse">Thầy giáo đang giải bài...</p>
                  </div>
                )}

                {result && !loading && (
                  <div className="markdown-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {result}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-100 flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-3 h-3 border border-bento-ink bg-bento-accent" />
                  <div className="w-3 h-3 border border-bento-ink bg-white" />
                  <div className="w-3 h-3 border border-bento-ink bg-bento-ink" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest opacity-30 italic">
                  Tự động kiểm tra xác xuất & logic
                </span>
              </div>
            </section>
          </div>

        </div>
      </div>

      {/* Retro Graphics */}
      <div className="fixed inset-0 pointer-events-none -z-10 opacity-[0.04]">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>
    </div>
  );
}
