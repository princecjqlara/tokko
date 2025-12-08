import type { MessageTag } from "../hooks/useMessageFormState";

type MessageProps = {
  message: string;
  setMessage: (v: string) => void;
  scheduleDate: string;
  setScheduleDate: (v: string) => void;
  attachedFile: File | null;
  setAttachedFile: (f: File | null) => void;
  messageTag: MessageTag;
  setMessageTag: (tag: MessageTag) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSend: () => void;
  onCancelSend: () => void;
  isUploadingFile: boolean;
  isSending: boolean;
  activeSends: number;
  hasActiveJob: boolean;
  isCancellingJob: boolean;
  onCancelJob?: () => void;
  icons: any;
  scheduledNotice: { id: number; scheduledFor: string; total: number } | null;
  onCancelScheduled: () => void;
  isCancellingSchedule: boolean;
};

export function MessageComposer({
  message,
  setMessage,
  scheduleDate,
  setScheduleDate,
  attachedFile,
  setAttachedFile,
  messageTag,
  setMessageTag,
  fileInputRef,
  onSend,
  onCancelSend,
  isUploadingFile,
  isSending,
  activeSends,
  hasActiveJob,
  isCancellingJob,
  onCancelJob,
  icons,
  scheduledNotice,
  onCancelScheduled,
  isCancellingSchedule
}: MessageProps) {
  const disableSend = isUploadingFile || isSending || hasActiveJob;
  const disableCancel = !isSending && !hasActiveJob;

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 shadow-lg shadow-black/30 space-y-4">
      {scheduledNotice && (
        <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-100 flex items-center justify-between">
          <div>
            Scheduled {scheduledNotice.total} message(s) for {new Date(scheduledNotice.scheduledFor).toLocaleString()}
          </div>
          <button
            onClick={onCancelScheduled}
            disabled={isCancellingSchedule}
            className="text-xs text-indigo-200 underline disabled:opacity-60"
          >
            {isCancellingSchedule ? "Cancelling..." : "Cancel"}
          </button>
        </div>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Write your broadcast message..."
        rows={6}
        className="w-full rounded-xl bg-zinc-900/70 border border-white/10 px-4 py-3 text-sm text-white focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => setAttachedFile(e.target.files?.[0] || null)}
            className="text-sm text-zinc-200"
          />
          {attachedFile && (
            <span className="text-xs text-zinc-400 truncate max-w-[200px]">{attachedFile.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="flex-1 rounded-xl bg-zinc-900/70 border border-white/10 px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
          />
          <span className="text-xs text-zinc-500">Philippines time</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400">Message tag</label>
          <select
            value={messageTag}
            onChange={(e) => setMessageTag(e.target.value as MessageTag)}
            className="rounded-lg bg-zinc-900/70 border border-white/10 px-2 py-2 text-sm text-white focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="ACCOUNT_UPDATE">Account Update</option>
            <option value="CONFIRMED_EVENT_UPDATE">Confirmed Event Update</option>
            <option value="POST_PURCHASE_UPDATE">Post Purchase Update</option>
            <option value="HUMAN_AGENT">Human Agent (7-day window)</option>
          </select>
        </div>
        {hasActiveJob && (
          <div className="flex items-center justify-end gap-2 text-xs text-indigo-200">
            <span>Background broadcast in progress</span>
            <button
              onClick={onCancelJob}
              disabled={isCancellingJob}
              className="underline disabled:opacity-60"
            >
              {isCancellingJob ? "Cancelling..." : "Cancel job"}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onCancelSend}
          disabled={disableCancel}
          className="text-sm text-zinc-300 hover:text-white disabled:opacity-60"
        >
          {isCancellingJob ? "Cancelling..." : "Cancel send"}
        </button>
        <button
          onClick={onSend}
          disabled={disableSend}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {icons.PaperAirplaneIcon?.()}
          <span>{isSending ? "Sending..." : scheduleDate ? "Schedule" : "Send"} broadcast</span>
          {(activeSends > 0 || isSending) && (
            <span className="text-xs text-indigo-200">({Math.max(activeSends, 1)} active)</span>
          )}
        </button>
      </div>
    </div>
  );
}
