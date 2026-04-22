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

type SolveMode = 'FULL' | 'SHORT';
type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY';

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
  const [questionType, setQuestionType] = useState<QuestionType>('ESSAY');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<PastSolution[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        throw new Error("Không tìm thấy GEMINI_API_KEY trong hệ thống.");
      }
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      const typeInstruction = {
        'MULTIPLE_CHOICE': 'Đây là câu hỏi Trắc nghiệm khách quan (4 phương án). Hãy chọn đáp án đúng và giải thích lý do chọn.',
        'TRUE_FALSE': 'Đây là câu hỏi Trắc nghiệm đúng sai. Hãy xác định từng ý đúng hay sai và giải thích ngắn gọn.',
        'SHORT_ANSWER': 'Đây là câu hỏi Trắc nghiệm trả lời ngắn. Hãy tính toán và đưa ra kết quả số hoặc biểu thức ngắn gọn.',
        'ESSAY': 'Đây là bài toán Tự luận. Hãy trình bày lời giải chi tiết, đầy đủ các bước lập luận.'
      }[questionType];

      const structureInstruction = mode === 'FULL' 
        ? `
1. TÓM TẮT ĐỀ BÀI: Viết lại ngắn gọn, rõ ràng, chuẩn hóa ký hiệu.
2. PHÂN TÍCH: Xác định dạng toán. Nêu hướng giải.
3. LỜI GIẢI CHI TIẾT: Trình bày từng bước theo SGK. Mỗi bước phải có lý do. Không nhảy bước.
` 
        : `
1. ĐỀ BÀI: Ghi lại đề bài ngắn gọn.
2. LỜI GIẢI CHI TIẾT: Trình bày các bước giải toán chính xác.
`;

      const systemInstruction = `
Bạn là giáo viên toán THCS/THPT tại Việt Nam, có kinh nghiệm giảng dạy và trình bày bài giải theo chuẩn sách giáo khoa (SGK).

🎯 MỤC TIÊU:
Giải bài toán một cách:
- Chính xác tuyệt đối
- Logic chặt chẽ
- Trình bày rõ ràng, dễ hiểu cho học sinh

📌 DẠNG BÀI: ${typeInstruction}

📌 YÊU CẦU TRÌNH BÀY (BẮT BUỘC):
${structureInstruction}
4. HÌNH VẼ MINH HỌA (Dành cho Hình học/Đồ thị): 
   - Sử dụng mã SVG để vẽ hình trực quan. 
   - Đặt mã SVG vào trong khối code block mác là \`svg\`. Ví dụ:
     \`\`\`svg
     <svg ...>...</svg>
     \`\`\`
   - Đảm bảo hình vẽ có màu sắc rõ ràng (stroke="black", stroke-width="2", fill="none" hoặc màu nhạt).
   - Có các thẻ <text> để ghi chú tên các đỉnh (A, B, C...) và các số đo.
5. KẾT LUẬN: Đưa ra đáp án cuối cùng. Ghi rõ điều kiện (nếu có).

📐 QUY TẮC VIẾT CÔNG THỨC:
- TẤT CẢ công thức toán phải viết bằng LaTeX.
- Dùng:
  + Inline: $...$
  + Xuống dòng: $$...$$
- KHÔNG viết công thức dạng text.

🧠 QUY TẮC SUY LUẬN:
- Sử dụng kiến thức phù hợp trình độ học sinh.
- Nếu bài tập là Hình học, BẮT BUỘC phải tạo SVG minh họa để học sinh dễ hình dung. Vẽ chính xác các tỉ lệ và ghi chú tên điểm rõ ràng.
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
    <div className="min-h-screen p-4 lg:p-12 transition-all font-sans">
      <div className="max-w-7xl mx-auto flex flex-col gap-10">
        
        {/* Header */}
        <header className="bento-card-header !p-10 !shadow-bento">
          <div className="flex items-center gap-8">
            <div className="bg-bento-accent p-5 border-2 border-bento-ink text-bento-ink shadow-[5px_5px_0px_white] rounded-2xl rotate-[-2deg]">
              <BookOpen className="w-10 h-10" />
            </div>
            <div>
              <h1 className="font-black text-4xl leading-none uppercase tracking-tighter">Thầy Giáo AI</h1>
              <p className="text-xs mt-2 opacity-60 uppercase tracking-[0.4em] font-black">Chuyên Gia Giải Toán SGK</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-4 bg-white/10 p-2 border-2 border-white/20 rounded-2xl">
              {(['ESSAY', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER'] as QuestionType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setQuestionType(t)}
                  className={cn(
                    "px-4 py-3 text-[10px] font-black transition-all uppercase tracking-wider rounded-xl",
                    questionType === t 
                      ? "bg-bento-accent text-bento-ink shadow-bento-sm" 
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  {t === 'ESSAY' ? 'Tự luận' : 
                   t === 'MULTIPLE_CHOICE' ? 'TN Khách quan' : 
                   t === 'TRUE_FALSE' ? 'TN Đúng/Sai' : 'Trả lời ngắn'}
                </button>
              ))}
            </div>
            <div className="h-8 w-px bg-white/20 hidden lg:block" />
            <div className="hidden lg:flex items-center gap-4 bg-white/10 p-2 border-2 border-white/20 rounded-2xl">
              {(['FULL', 'SHORT'] as SolveMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-8 py-3 text-[11px] font-black transition-all uppercase tracking-[0.2em] rounded-xl",
                    mode === m 
                      ? "bg-white text-bento-ink shadow-bento-sm" 
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  {m === 'FULL' ? 'Chi tiết' : 'Rút gọn'}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-5 flex flex-col gap-10">
            <section className="bento-card flex-1 min-h-[500px] !p-10">
              <div className="flex items-center justify-between mb-10">
                <span className="bento-label">
                  <div className="w-3 h-3 bg-bento-primary rounded-full animate-pulse" />
                  01. Đề bài & Tài liệu
                </span>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 border-2 border-bento-ink bg-white hover:bg-bento-light-blue transition-all rounded-xl shadow-bento-sm active:shadow-none translate-y-[-2px] active:translate-y-0"
                    title="Tải lên Ảnh hoặc PDF"
                  >
                    <FileUp className="w-5 h-5 text-bento-ink" />
                  </button>
                </div>
              </div>
              
              {selectedFile && (
                <div className="mb-8 p-5 bg-bento-primary/5 border-2 border-bento-primary/30 border-dashed flex items-center justify-between rounded-2xl animate-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="bg-bento-ink text-white p-3 rounded-xl">
                      {selectedFile.mimeType.startsWith('image/') ? (
                        <ImageIcon className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider block text-slate-400">File đính kèm</span>
                      <span className="text-sm font-bold truncate max-w-[180px] block">{selectedFile.name}</span>
                    </div>
                  </div>
                  <button onClick={removeFile} className="p-3 hover:bg-red-50 text-red-500 transition-colors rounded-xl border-2 border-transparent hover:border-red-200">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder={selectedFile ? "Nhập thêm ghi chú (không bắt buộc)..." : "Nhập câu hỏi hoặc đề bài tại đây..."}
                className="w-full flex-1 resize-none border-none focus:ring-0 text-lg font-medium leading-relaxed placeholder:opacity-30 p-2"
              />
              
              <div className="mt-10">
                <button
                  onClick={handleSolve}
                  disabled={loading || (!problem.trim() && !selectedFile)}
                  className="w-full bento-button !text-base !py-6 !rounded-2xl"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Đang phân tích đề...
                    </>
                  ) : (
                    <>
                      <Send className="w-6 h-6" />
                      Bắt Đầu Giải Toán
                    </>
                  )}
                </button>
              </div>
            </section>

            <section className="bento-card border-dashed bg-slate-50/50 shadow-none !p-10">
              <div className="flex items-center justify-between mb-8">
                <h3 className="bento-label">
                  <History className="w-4 h-4" /> 
                  02. Nhật ký học tập
                </h3>
                {history.length > 0 && (
                  <button onClick={clearHistory} className="text-slate-400 hover:text-red-500 transition-colors uppercase text-[10px] font-black tracking-widest flex items-center gap-2">
                    <Trash2 className="w-4 h-4" /> Làm sạch
                  </button>
                )}
              </div>
              
              {history.length === 0 ? (
                <div className="py-2 space-y-5 opacity-40">
                  <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-widest">
                    <div className="w-5 h-5 border-2 border-bento-ink rounded-lg" />
                    <span>Hỗ trợ Hình học & Đại số</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-widest">
                    <div className="w-5 h-5 border-2 border-bento-ink rounded-lg" />
                    <span>Chuẩn kiến thức SGK</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-h-[250px] overflow-y-auto pr-4 custom-scrollbar">
                  {history.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setProblem(item.problem.replace('...', ''));
                        setResult(item.solution);
                      }}
                      className="w-full text-left p-5 border-2 border-bento-ink hover:bg-white hover:shadow-bento-sm transition-all flex items-center justify-between group bg-white/50 rounded-2xl"
                    >
                      <div className="flex flex-col gap-2 overflow-hidden">
                        <p className="text-[11px] font-black uppercase truncate group-hover:text-bento-primary transition-colors">{item.problem}</p>
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider">{item.timestamp}</span>
                      </div>
                      <div className="p-2 bg-bento-light-blue rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                        <BookOpen className="w-4 h-4 text-bento-primary" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Result */}
          <div className="lg:col-span-7">
            <section className={cn(
              "bento-card min-h-[750px] h-full relative overflow-hidden !p-0",
              !result && "justify-center items-center text-center bg-white"
            )}>
              {result && (
                <div className="absolute top-0 left-0 right-0 p-8 border-b-2 border-bento-ink flex items-center justify-between bg-white/95 backdrop-blur-xl z-30 sticky rounded-t-2xl">
                  <span className="bento-label m-0">03. Lời Giải Hệ Thống</span>
                  <button 
                    onClick={() => {
                      const cleanText = result.replace(/```svg[\s\S]*?```/g, '').trim();
                      navigator.clipboard.writeText(cleanText);
                      alert("Đã sao chép lời giải (không bao gồm mã hình vẽ)!");
                    }}
                    className="bento-button !py-3 !px-6 !text-[10px] !rounded-xl"
                  >
                    Sao Chép LaTeX
                  </button>
                </div>
              )}
              
              <div className="p-8 lg:p-14 flex-1">
                {!result && !loading && (
                  <div className="py-24 animate-in zoom-in duration-700">
                    <div className="w-32 h-32 bg-bento-accent border-2 border-bento-ink mx-auto flex items-center justify-center mb-10 rotate-6 shadow-bento rounded-[2.5rem]">
                      <BookOpen className="w-14 h-14 text-bento-ink" />
                    </div>
                    <h3 className="font-serif italic text-4xl text-bento-ink mb-6">Đang đợi yêu cầu...</h3>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] max-w-sm mx-auto leading-relaxed">
                      Hãy nhập bài toán bên trái để Thầy Giáo AI bắt đầu thực hiện nhiệm vụ.
                    </p>
                  </div>
                )}
                
                {loading && (
                  <div className="py-28 flex flex-col items-center justify-center h-full">
                    <div className="relative w-28 h-28 mb-12">
                      <Loader2 className="absolute inset-0 w-full h-full text-bento-primary animate-[spin_1.5s_linear_infinite]" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-bento-accent border-[3px] border-bento-ink rounded-2xl rotate-45 animate-pulse shadow-xl" />
                      </div>
                    </div>
                    <p className="font-serif italic text-3xl text-bento-ink animate-pulse">Đang giải bài, đợi chút nhé...</p>
                    <div className="mt-10 flex gap-3">
                       <div className="w-3 h-3 bg-bento-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                       <div className="w-3 h-3 bg-bento-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                       <div className="w-3 h-3 bg-bento-primary rounded-full animate-bounce" />
                    </div>
                  </div>
                )}

                {result && !loading && (
                  <div className="markdown-body animate-in fade-in duration-1000 pt-10">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        code({ node, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const isSvg = match && match[1] === 'svg';
                          
                          if (isSvg) {
                            const svgCode = String(children);
                            const downloadSvg = () => {
                              const blob = new Blob([svgCode], { type: 'image/svg+xml' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `hinh_ve_toan_${Date.now()}.svg`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(url);
                            };

                            return (
                              <div className="my-8 group relative">
                                <div 
                                  className="flex justify-center p-6 bg-white border-2 border-slate-100 rounded-3xl shadow-sm overflow-auto"
                                  dangerouslySetInnerHTML={{ __html: svgCode }}
                                />
                                <button 
                                  onClick={downloadSvg}
                                  className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur border-2 border-slate-200 rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:bg-white hover:border-bento-primary text-slate-500 hover:text-bento-primary flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                  title="Tải ảnh về để chèn vào Word"
                                >
                                  <FileUp className="w-3 h-3" />
                                  Lưu hình ảnh
                                </button>
                              </div>
                            );
                          }
                          return (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {result}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              
              <div className="mx-10 mb-10 p-10 border-t-2 border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-bento-primary text-white text-[10px] font-extrabold px-3 py-1.5 uppercase tracking-widest rounded-lg">
                    Math Expert AI
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 italic">
                    Solution v3.1 Pro
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <div className="w-5 h-5 bg-bento-accent border-2 border-bento-ink rounded-lg shadow-sm" />
                  <div className="w-5 h-5 bg-bento-primary border-2 border-bento-ink rounded-lg shadow-sm" />
                  <div className="w-5 h-5 bg-bento-ink border-2 border-bento-ink rounded-lg shadow-sm" />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Grid Pattern Background */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-slate-50">
        <div className="absolute inset-0 bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] [background-size:32px_32px] opacity-30" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:100px_100px] opacity-10" />
      </div>
    </div>
  );
}
