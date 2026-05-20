import {useEffect, useRef, useState} from 'react';
import {AlertTriangle, CheckCircle2, Database, Download, HardDrive, KeyRound, Loader2, RefreshCw, RotateCcw, Server, Upload, Wifi, X} from 'lucide-react';
import {backupAppData, exportAppData, importAppData, loadReadyStatus, ReadyStatus} from '../services/classroomApi';
import {getStoredBridgeHost, setBridgeHost} from '../services/apiClient';

type SystemSettingsPanelProps = {
  onClose: () => void;
};

type ActionMessage = {
  tone: 'info' | 'success' | 'error';
  text: string;
};

function downloadJsonFile(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SystemSettingsPanel({onClose}: SystemSettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [ready, setReady] = useState<ReadyStatus | null>(null);
  const [loadingReady, setLoadingReady] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<ActionMessage | null>(null);
  const [bridgeHostInput, setBridgeHostInput] = useState(() => getStoredBridgeHost());
  const [resetConfirm, setResetConfirm] = useState(false);

  const refreshReady = async () => {
    setLoadingReady(true);
    try {
      setReady(await loadReadyStatus());
    } catch (error) {
      setReady(null);
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : '無法取得系統狀態',
      });
    } finally {
      setLoadingReady(false);
    }
  };

  useEffect(() => {
    void refreshReady();
  }, []);

  const runExport = async () => {
    setActionBusy('export');
    setMessage(null);
    try {
      const payload = await exportAppData();
      const stamp = payload.exportedAt.replace(/[:.]/g, '-');
      downloadJsonFile(`whiteboard-export-${stamp}.json`, payload);
      setMessage({tone: 'success', text: `已匯出 ${payload.notes.length} 筆課堂紀錄與 ${payload.chat.length} 則聊天紀錄。`});
    } catch (error) {
      setMessage({tone: 'error', text: error instanceof Error ? error.message : '匯出失敗'});
    } finally {
      setActionBusy(null);
    }
  };

  const runBackup = async () => {
    setActionBusy('backup');
    setMessage(null);
    try {
      const result = await backupAppData();
      setMessage({tone: 'success', text: `已建立備份：${result.backup.filename}`});
      await refreshReady();
    } catch (error) {
      setMessage({tone: 'error', text: error instanceof Error ? error.message : '備份失敗'});
    } finally {
      setActionBusy(null);
    }
  };

  const runImport = async (file: File) => {
    setActionBusy('import');
    setMessage(null);
    try {
      const text = (await file.text()).trim();
      const payload = JSON.parse(text);
      const result = await importAppData(payload);
      window.dispatchEvent(new CustomEvent('whiteboard-notes-updated'));
      setMessage({
        tone: 'success',
        text: `已還原 ${result.updated.join('、')}。課堂紀錄 ${result.counts.notes ?? 0} 筆，聊天 ${result.counts.chat ?? 0} 則。`,
      });
      await refreshReady();
    } catch (error) {
      setMessage({tone: 'error', text: error instanceof Error ? error.message : '還原失敗'});
    } finally {
      setActionBusy(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const saveBridgeHost = () => {
    setBridgeHost(bridgeHostInput);
    setMessage({tone: 'success', text: bridgeHostInput.trim() ? `橋接主機已設定為 ${bridgeHostInput.trim()}，重新整理後生效。` : '已清除自訂橋接主機，改用本機預設（localhost）。'});
  };

  const runDemoReset = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    setActionBusy('reset');
    try {
      sessionStorage.clear();
      const keysToRemove = ['whiteboard-notes', 'whiteboard-chat:elementary:v1', 'app1:practiceCardCollapsed', 'tour-app1:v1'];
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      try {
        await fetch('/api/ops/reset', {method: 'POST'});
      } catch { /* bridge may be offline, that's ok */ }
    } finally {
      window.location.reload();
    }
  };

  const statusOk = ready?.ok ?? false;

  return (
    <div className="bg-surface w-full max-w-2xl rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl border border-white/50 relative max-h-[88dvh] overflow-y-auto">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center hover:bg-surface-container-low transition-colors"
        aria-label="關閉設定"
      >
        <X className="w-5 h-5 text-on-surface" />
      </button>

      <div className="pr-12">
        <p className="text-xs font-bold tracking-widest text-primary">展示維運</p>
        <h2 className="text-2xl sm:text-3xl font-headline font-extrabold mt-2">系統設定與資料維運</h2>
        <p className="text-sm text-on-surface-variant mt-2">管理本機硬體、AI 狀態、資料備份與匯入。</p>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatusBlock
          icon={Server}
          title="本機硬體"
          value={ready ? '可展示' : '檢查中'}
          ok={Boolean(ready)}
          loading={loadingReady}
        />
        <StatusBlock
          icon={HardDrive}
          title="資料目錄"
          value={ready?.storage.writable ? '可寫入' : '未確認'}
          ok={ready?.storage.writable}
          loading={loadingReady}
        />
        <StatusBlock
          icon={KeyRound}
          title="Gemini"
          value={ready?.geminiConfigured ? '已設定' : '本機示範'}
          ok={true}
          loading={loadingReady}
        />
        <StatusBlock
          icon={Database}
          title="展示包"
          value={ready?.staticBuild.available ? `${ready.staticBuild.assetCount} 個檔案` : '尚未產生'}
          ok={ready?.staticBuild.available}
          loading={loadingReady}
        />
      </div>

      {ready && (
        <div className={`mt-4 flex items-start gap-3 rounded-xl border p-4 ${
          statusOk ? 'border-primary/20 bg-primary-container/50 text-on-primary-container' : 'border-tertiary/25 bg-tertiary-container/45 text-on-tertiary-container'
        }`}>
          {statusOk ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
          <div>
            <p className="text-sm font-extrabold">{statusOk ? '系統可用' : '需要處理'}</p>
            <p className="text-xs mt-1 break-words">{ready.checks.map((check) => `${check.name}: ${check.message}`).join('；')}</p>
          </div>
        </div>
      )}

      {message && (
        <div className={`mt-4 rounded-xl border p-4 text-sm ${
          message.tone === 'success'
            ? 'border-primary/20 bg-primary-container/50 text-on-primary-container'
            : message.tone === 'error'
              ? 'border-tertiary/25 bg-tertiary-container/45 text-on-tertiary-container'
              : 'border-outline-variant/30 bg-surface-container text-on-surface-variant'
        }`}>
          {message.text}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ActionButton
          icon={RefreshCw}
          title="重新檢查"
          desc="更新硬體與資料目錄狀態"
          onClick={refreshReady}
          busy={loadingReady}
        />
        <ActionButton
          icon={Download}
          title="匯出資料"
          desc="下載完整 JSON 匯出檔"
          onClick={runExport}
          busy={actionBusy === 'export'}
        />
        <ActionButton
          icon={Database}
          title="建立本機備份"
          desc="寫入 data/backups 資料夾"
          onClick={runBackup}
          busy={actionBusy === 'backup'}
        />
        <ActionButton
          icon={Upload}
          title="還原匯出檔"
          desc="匯入課堂紀錄、聊天與課堂狀態"
          onClick={() => fileInputRef.current?.click()}
          busy={actionBusy === 'import'}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void runImport(file);
          }
        }}
      />

      <div className="mt-6 rounded-xl border border-outline-variant/25 bg-surface-container-low p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wifi className="w-4 h-4 text-primary" />
          <p className="font-extrabold text-on-surface text-sm">橋接主機（跨裝置連線）</p>
        </div>
        <p className="text-xs text-on-surface-variant mb-3">平板連老師電腦時填入老師電腦 IP，例如 <code className="bg-surface-container-highest px-1 rounded">192.168.1.5:3201</code>。留空使用本機預設。</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={bridgeHostInput}
            onChange={(e) => setBridgeHostInput(e.target.value)}
            placeholder="留空 = 本機 localhost"
            className="flex-1 rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={saveBridgeHost}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:opacity-90 transition-opacity"
          >
            儲存
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-tertiary/30 bg-tertiary-container/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <RotateCcw className="w-4 h-4 text-tertiary" />
          <p className="font-extrabold text-on-surface text-sm">重置練習資料</p>
        </div>
        <p className="text-xs text-on-surface-variant mb-3">清除首頁分析結果、練習打勾、聊天紀錄、tour 進度，讓學生從零開始練習。不影響課堂紀錄本。</p>
        <button
          type="button"
          disabled={actionBusy === 'reset'}
          onClick={() => void runDemoReset()}
          className={`w-full rounded-lg border px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
            resetConfirm
              ? 'border-tertiary bg-tertiary text-on-tertiary'
              : 'border-tertiary/40 text-tertiary hover:bg-tertiary/10'
          }`}
        >
          {actionBusy === 'reset' ? '重置中…' : resetConfirm ? '確認重置（再按一次）' : '重置練習資料'}
        </button>
        {resetConfirm && (
          <p className="text-xs text-tertiary mt-2 text-center">再按一次確認，頁面會重新整理。</p>
        )}
      </div>
    </div>
  );
}

function StatusBlock({icon: Icon, title, value, ok, loading}: {
  icon: typeof Server;
  title: string;
  value: string;
  ok?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-outline-variant/25 bg-surface-container-low p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-on-surface-variant" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-on-surface-variant">{title}</p>
            <p className="text-sm font-extrabold truncate">{value}</p>
          </div>
        </div>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant shrink-0" />
        ) : (
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ok ? 'bg-primary' : 'bg-tertiary'}`} />
        )}
      </div>
    </div>
  );
}

function ActionButton({icon: Icon, title, desc, onClick, busy}: {
  icon: typeof Download;
  title: string;
  desc: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded-xl border border-outline-variant/25 bg-surface-container-low p-4 text-left hover:border-primary/40 hover:bg-primary-container/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0">
          {busy ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Icon className="w-5 h-5 text-primary" />}
        </div>
        <div>
          <p className="font-extrabold text-on-surface">{title}</p>
          <p className="text-xs text-on-surface-variant mt-1">{desc}</p>
        </div>
      </div>
    </button>
  );
}
