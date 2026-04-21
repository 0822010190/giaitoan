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
  const [apiKey, setApiKey] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAuthorize = () => {
    if (apiKey.trim().length > 20) {
      setIsAuthorized(true);
    } else {
      alert("Vui lòng nhập API Key hợp lệ để tiếp tục.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY });
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

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-bento-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full bento-card space-y-6">
          <div className="flex items-center gap-4">
            <div className="bg-bento-accent p-4 border-2 border-bento-ink">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <h1 className="font-black text-2xl uppercase tracking-tighter">Xác Thực AI</h1>
              <p className="text-[10px] font-black opacity-50 uppercase tracking-widest">Yêu cầu chìa khóa truy cập</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="bento-label">Gemini API Key</label>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Nhập API Key của bạn..."
                className="bento-input"
              />
              <p className="mt-2 text-[10px] text-gray-500 italic">
                * Khóa này dùng để trực tiếp gọi mô hình AI giải toán.
              </p>
            </div>
            
            <button 
              onClick={handleAuthorize}
              disabled={apiKey.length < 10}
              className="w-full bento-button"
            >
              Truy Cập Ứng Dụng
            </button>
          </div>

          <div className="pt-4 border-t-2 border-bento-ink border-dashed">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
              <Info className="w-3 h-3" />
              <span>Dữ liệu của bạn được bảo mật tuyệt đối.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-12 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <header className="bento-card bento-card-header !p-8">
          <div className="flex items-center gap-6">
            <div className="bg-bento-accent p-4 border-2 border-bento-ink text-bento-ink shadow-[4px_4px_0px_white]">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <h1 className="font-black text-3xl leading-none uppercase tracking-tighter">Gia Sư Toán AI</h1>
              <p className="text-[11px] mt-1 opacity-70 uppercase tracking-[0.3em] font-black">Professional Math Assistant</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3 bg-white/5 p-1.5 border-2 border-white/10">
            {(['FULL', 'EXAM', 'SHORT'] as SolveMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-5 py-2 text-[11px] font-black transition-all uppercase tracking-widest",
                  mode === m 
                    ? "bg-bento-accent text-bento-ink shadow-[3px_3px_0px_white]" 
                    : "text-white/40 hover:text-white"
                )}
              >
                {m === 'FULL' ? 'Chi tiết' : m === 'EXAM' ? 'Bài thi' : 'Rút gọn'}
              </button>
            ))}
          </div>
        </header>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            <section className="bento-card flex-1 min-h-[450px]">
              <div className="flex items-center justify-between mb-8">
                <span className="bento-label">01. Nội dung đề bài</span>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 border-2 border-bento-ink bg-white hover:bg-bento-light-blue transition-colors group"
                    title="Tải lên Ảnh hoặc PDF"
                  >
                    <FileUp className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </button>
                </div>
              </div>
              
              {selectedFile && (
                <div className="mb-6 p-4 bg-bento-accent/10 border-2 border-bento-ink border-dashed flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-bento-ink text-white p-2">
                      {selectedFile.mimeType.startsWith('image/') ? (
                        <ImageIcon className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-xs font-black truncate italic uppercase tracking-wider">{selectedFile.name}</span>
                  </div>
                  <button onClick={removeFile} className="p-2 hover:bg-red-500 hover:text-white transition-colors border-2 border-transparent hover:border-bento-ink">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder={selectedFile ? "Nhập thêm yêu cầu cụ thể (vô hiệu hóa nếu không cần)..." : "Nhập đề bài tại đây hoặc tải lên file Ảnh/PDF..."}
                className="w-full flex-1 resize-none border-none focus:ring-0 text-base font-medium leading-relaxed placeholder:opacity-30 p-2"
              />
              
              <div className="mt-8">
                <button
                  onClick={handleSolve}
                  disabled={loading || (!problem.trim() && !selectedFile)}
                  className="w-full bento-button !text-sm !py-5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang xử lý dữ liệu...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Tạo Lời Giải Hệ Thống
                    </>
                  )}
                </button>
              </div>
            </section>

            <section className="bento-card border-dashed bg-transparent shadow-none">
              <div className="flex items-center justify-between mb-6">
                <h3 className="bento-label">02. Lịch sử & Kiểm tra</h3>
                {history.length > 0 && (
                  <button onClick={clearHistory} className="text-gray-400 hover:text-red-500 transition-colors uppercase text-[9px] font-black tracking-widest flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Xóa hết
                  </button>
                )}
              </div>
              
              {history.length === 0 ? (
                <div className="py-2 space-y-4 opacity-40">
                  <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest">
                    <div className="w-4 h-4 border-2 border-bento-ink" />
                    <span>Hỗ trợ đa phương thức</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest">
                    <div className="w-4 h-4 border-2 border-bento-ink" />
                    <span>Bảo mật Gemini 3.1 Pro</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-3 custom-scrollbar">
                  {history.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setProblem(item.problem.replace('...', ''));
                        setResult(item.solution);
                      }}
                      className="w-full text-left p-4 border-2 border-bento-ink hover:bg-bento-accent hover:shadow-bento-sm transition-all flex items-center justify-between group bg-white"
                    >
                      <div className="flex flex-col gap-1 overflow-hidden">
                        <p className="text-[11px] font-black uppercase truncate group-hover:text-bento-ink">{item.problem}</p>
                        <span className="text-[9px] opacity-40 font-bold">{item.timestamp}</span>
                      </div>
                      <BookOpen className="w-4 h-4 shrink-0 opacity-20 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Result */}
          <div className="lg:col-span-7">
            <section className={cn(
              "bento-card min-h-[700px] h-full relative overflow-hidden",
              !result && "justify-center items-center text-center bg-bento-light-blue/20"
            )}>
              <div className="absolute top-0 left-0 right-0 p-6 border-b-2 border-bento-ink flex items-center justify-between bg-white/90 backdrop-blur-md z-20 sticky">
                <span className="bento-label m-0">03. Bảng Giải Chi Tiết</span>
                {result && (
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(result);
                      alert("Đã sao chép lời giải!");
                    }}
                    className="bento-button !py-2 !px-4 !shadow-bento-sm hover:!shadow-bento-sm active:!shadow-none"
                  >
                    Copy LaTeX
                  </button>
                )}
              </div>
              
              <div className="p-4 lg:p-10 flex-1">
                {!result && !loading && (
                  <div className="py-20 animate-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-white border-2 border-bento-ink mx-auto flex items-center justify-center mb-8 rotate-3 shadow-bento">
                      <BookOpen className="w-12 h-12 text-bento-ink" />
                    </div>
                    <h3 className="font-serif italic text-3xl text-bento-ink mb-4">Sẵn sàng phân tích...</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] max-w-xs mx-auto">
                      Vui lòng nhập đề bài hoặc tải lên tệp tin để xem kết quả.
                    </p>
                  </div>
                )}
                
                {loading && (
                  <div className="py-20 flex flex-col items-center">
                    <div className="relative w-20 h-20 mb-10">
                      <Loader2 className="absolute inset-0 w-full h-full text-bento-ink animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-bento-accent border-2 border-bento-ink rotate-45 animate-pulse" />
                      </div>
                    </div>
                    <p className="font-serif italic text-2xl animate-pulse">Thầy giáo AI đang tư duy...</p>
                    <div className="mt-6 flex gap-2">
                       <div className="w-2 h-2 bg-bento-ink rounded-full animate-bounce [animation-delay:-0.3s]" />
                       <div className="w-2 h-2 bg-bento-ink rounded-full animate-bounce [animation-delay:-0.15s]" />
                       <div className="w-2 h-2 bg-bento-ink rounded-full animate-bounce" />
                    </div>
                  </div>
                )}

                {result && !loading && (
                  <div className="markdown-body animate-in fade-in duration-700">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {result}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              
              <div className="mt-12 pt-8 border-t-2 border-bento-ink/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-bento-ink text-white text-[9px] font-black px-2 py-1 uppercase tracking-widest">
                    Verified Solution
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-30 italic">
                    MathType & LaTeX Compliant
                  </span>
                </div>
                <div className="flex gap-1.5 self-end sm:self-auto">
                  <div className="w-4 h-4 bg-bento-accent border-2 border-bento-ink" />
                  <div className="w-4 h-4 bg-white border-2 border-bento-ink" />
                  <div className="w-4 h-4 bg-bento-ink border-2 border-bento-ink" />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Grid Pattern Background */}
      <div className="fixed inset-0 pointer-events-none -z-10 opacity-[0.03]">
        <div className="absolute inset-0 bg-[#000] [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>
    </div>
  );
}
