import {memo} from 'react';
import {Bot, ClipboardList, FileText, GraduationCap, NotebookPen, Sparkles} from 'lucide-react';
import type {BoardAnalysisResponse, OcrLocalResult} from '../../services/classroomApi';

type BoardTextPanelProps = {
  analysis: BoardAnalysisResponse | null;
  ocrResult: OcrLocalResult | null;
  ocrBusy: boolean;
  onNavigate: (tab: string) => void;
};

function extractForStudents(content: string): {goal?: string; check?: string} {
  if (!content) return {};
  const goal = content.match(/今日學習目標[：:]?\s*([\s\S]*?)(?=\n[^\n]*[：:]|$)/)?.[1]?.trim();
  const check = content.match(/小朋友練習[：:]?\s*([\s\S]*?)(?=\n[^\n]*[：:]|$)/)?.[1]?.trim();
  return {goal, check};
}

export const BoardTextPanel = memo(function BoardTextPanel({analysis, ocrResult, ocrBusy, onNavigate}: BoardTextPanelProps) {
  const ocrText = (analysis?.noteDraft.ocrText || ocrResult?.text || '').trim();
  const studentBits = extractForStudents(analysis?.noteDraft.content ?? '');

  return (
    <section className="xl:col-span-5 bg-surface-container-high rounded-lg p-4 sm:p-5 border border-outline-variant/20" data-tour="region-panel">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary shrink-0">
          <FileText className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold">白板文字整理</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {ocrBusy ? '正在讀白板文字…' : ocrText ? `辨識出 ${ocrText.replace(/\s/g, '').length} 個字` : '按「整理」後 AI 會讀白板文字並用孩子聽得懂的話解釋。'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant mb-1.5">白板原文</p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-on-surface bg-surface rounded-xl p-4 max-h-44 overflow-y-auto border border-outline-variant/20">
            {ocrText || '（按「整理」後出現）'}
          </pre>
        </div>

        {analysis && (
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-primary mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI 用孩子聽得懂的話說
            </p>
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-sm leading-relaxed space-y-2">
              <p className="font-extrabold text-on-surface">{analysis.noteDraft.title}</p>
              <p className="text-on-surface">{analysis.noteDraft.desc}</p>
              {studentBits.goal && (
                <div className="pt-2 border-t border-primary/15">
                  <p className="text-[11px] font-black text-primary mb-1">🎯 今天要學會</p>
                  <p className="text-on-surface whitespace-pre-line">{studentBits.goal}</p>
                </div>
              )}
              {studentBits.check && (
                <div className="pt-2 border-t border-primary/15">
                  <p className="text-[11px] font-black text-primary mb-1">✏️ 試試看</p>
                  <p className="text-on-surface whitespace-pre-line">{studentBits.check}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {analysis && (
          <div className="pt-3 border-t border-outline-variant/20">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant mb-2">孩子下一步</p>
            <button
              type="button"
              onClick={() => onNavigate('chat')}
              className="w-full min-h-14 px-4 rounded-xl bg-primary text-on-primary text-base font-extrabold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mb-2 shadow-md shadow-primary/20"
            >
              <Bot className="w-5 h-5" /> 問 AI 小老師
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onNavigate('review')}
                aria-label="變成小測驗"
                className="min-h-14 rounded-xl bg-surface-container-highest hover:bg-primary hover:text-on-primary transition-colors flex flex-col items-center justify-center gap-0.5"
              >
                <ClipboardList className="w-5 h-5" />
                <span className="text-[11px] font-extrabold">小測驗</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('library')}
                aria-label="到課堂紀錄本"
                className="min-h-14 rounded-xl bg-surface-container-highest hover:bg-primary hover:text-on-primary transition-colors flex flex-col items-center justify-center gap-0.5"
              >
                <NotebookPen className="w-5 h-5" />
                <span className="text-[11px] font-extrabold">紀錄本</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('teacher')}
                aria-label="老師決策"
                className="min-h-14 rounded-xl bg-surface-container-highest hover:bg-primary hover:text-on-primary transition-colors flex flex-col items-center justify-center gap-0.5"
              >
                <GraduationCap className="w-5 h-5" />
                <span className="text-[11px] font-extrabold">老師決策</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
});
