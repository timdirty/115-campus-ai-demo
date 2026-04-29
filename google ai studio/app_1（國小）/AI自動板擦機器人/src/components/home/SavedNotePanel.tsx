import type {WhiteboardNote} from '../../services/notesStore';

type SavedNotePanelProps = {
  latestNote: WhiteboardNote | null;
  onNavigate: (tab: string) => void;
};

export function SavedNotePanel({latestNote, onNavigate}: SavedNotePanelProps) {
  return (
    <section className="lg:col-span-2 bg-surface-container-low rounded-lg p-5 border border-outline-variant/20">
      <h2 className="text-xl font-extrabold mb-4">最新課堂紀錄</h2>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-44 aspect-video bg-surface rounded-lg overflow-hidden border border-outline-variant/20">
          {latestNote?.img ? <img src={latestNote.img} alt={latestNote.title} className="w-full h-full object-cover" /> : null}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-primary uppercase">{latestNote?.subject ?? '尚無紀錄'}</p>
          <h3 className="text-2xl font-extrabold mt-1 break-words">{latestNote?.title ?? '請先拍白板或新增一筆課堂紀錄'}</h3>
          <p className="text-sm text-on-surface-variant mt-2 line-clamp-3">{latestNote?.desc ?? '保存後會出現在課堂紀錄本、AI 小老師與學習單生成器。'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate('library')} className="min-h-10 px-4 rounded-md bg-surface hover:bg-primary hover:text-on-primary text-sm font-bold">
              紀錄本
            </button>
            <button type="button" onClick={() => onNavigate('review')} className="min-h-10 px-4 rounded-md bg-primary text-on-primary text-sm font-bold">
              做學習單
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
