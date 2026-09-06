import React, { useState } from "react";
import { 
  Terminal, 
  Trash2, 
  Copy, 
  Check, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Filter,
  Radio,
  Smartphone
} from "lucide-react";
import { ExecutionLog } from "../types";

interface ExecutionTerminalProps {
  logs: ExecutionLog[];
  onClearLogs: () => void;
}

export const ExecutionTerminal: React.FC<ExecutionTerminalProps> = ({
  logs,
  onClearLogs,
}) => {
  const [filter, setFilter] = useState<"ALL" | "ANDROID_BRIDGE" | "SIMULATOR">("ALL");
  const [copied, setCopied] = useState(false);

  const filteredLogs = logs.filter((l) => {
    if (filter === "ALL") return true;
    return l.engine === filter;
  });

  const handleCopyLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.engine}] [${l.status}] ${l.command} (${l.durationMs}ms) - ${l.details}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-xl">
      {/* Terminal Header */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-200 font-mono">
            Android Bridge & Action Execution Audit Log
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            ({logs.length} events)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Filter */}
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px]">
            {(["ALL", "ANDROID_BRIDGE", "SIMULATOR"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded-lg font-mono transition-colors ${
                  filter === f
                    ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Copy audit logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClearLogs}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="p-3 sm:p-4 font-mono text-[11px] bg-slate-950/90 text-slate-300 max-h-56 overflow-y-auto space-y-2 scrollbar-thin">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-500 text-center py-6">
            No system execution commands dispatched yet. Submit a natural language issue in the assistant to observe live bridge execution logs.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col space-y-1 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500">{log.timestamp}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-semibold ${
                      log.engine === "ANDROID_BRIDGE"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : log.engine === "SIMULATOR"
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {log.engine}
                  </span>
                  <span
                    className={`flex items-center space-x-1 ${
                      log.status === "SUCCESS"
                        ? "text-emerald-400"
                        : log.status === "BLOCKED"
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {log.status === "SUCCESS" ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    <span>{log.status}</span>
                  </span>
                </div>
                <span className="text-slate-500 font-mono">{log.durationMs}ms</span>
              </div>

              <div className="text-emerald-300 font-semibold break-all">
                {log.command}
              </div>

              <div className="text-[10px] text-slate-400 leading-tight">
                {log.details}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
