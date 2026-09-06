import React, { useState } from "react";
import { 
  Code2, 
  Copy, 
  Check, 
  Download, 
  FileCode, 
  FolderTree,
  ExternalLink,
  Sparkles
} from "lucide-react";
import { BOILERPLATE_CODE_SNIPPETS } from "../data/boilerplateCode";
import { CodeSnippet } from "../types";

export const CodeViewer: React.FC = () => {
  const [selectedSnippetId, setSelectedSnippetId] = useState<string>("kotlin-gemini-service");
  const [filterCategory, setFilterCategory] = useState<"all" | "kotlin" | "flutter" | "manifest" | "gradle">("all");
  const [copied, setCopied] = useState(false);

  const filteredSnippets = BOILERPLATE_CODE_SNIPPETS.filter((snippet) => {
    if (filterCategory === "all") return true;
    return snippet.category === filterCategory;
  });

  const activeSnippet: CodeSnippet =
    BOILERPLATE_CODE_SNIPPETS.find((s) => s.id === selectedSnippetId) ||
    BOILERPLATE_CODE_SNIPPETS[0];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeSnippet.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([activeSnippet.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = activeSnippet.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
            <Code2 className="w-3.5 h-3.5" />
            <span>Production-Ready Codebase Boilerplate</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">
            Android Native (Kotlin / Compose) & Flutter (Dart) Source Boilerplate
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Drop these production modules directly into your Android Studio or Flutter workspace.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          {(["all", "kotlin", "flutter", "manifest", "gradle"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setFilterCategory(cat);
                const first = BOILERPLATE_CODE_SNIPPETS.find((s) => cat === "all" || s.category === cat);
                if (first) setSelectedSnippetId(first.id);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                filterCategory === cat
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {cat === "all" ? "All Files" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Code Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Sidebar: File Tree */}
        <div className="lg:col-span-1 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 flex flex-col space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider px-2">
            <FolderTree className="w-4 h-4 text-emerald-400" />
            <span>Architecture Files</span>
          </div>

          <div className="space-y-1 overflow-y-auto max-h-[580px] scrollbar-none">
            {filteredSnippets.map((item) => {
              const isActive = item.id === activeSnippet.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedSnippetId(item.id)}
                  className={`w-full text-left p-3 rounded-2xl text-xs transition-all flex flex-col space-y-1 ${
                    isActive
                      ? "bg-emerald-500/15 border border-emerald-500/40 text-slate-100 shadow-sm"
                      : "bg-slate-950/50 border border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                    <span className="font-mono font-semibold text-[11px] truncate">{item.filename}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 line-clamp-1">
                    {item.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Code Display Area */}
        <div className="lg:col-span-3 bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden flex flex-col">
          
          {/* File Top Bar */}
          <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <span className="font-mono text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                {activeSnippet.filename}
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline font-sans">
                {activeSnippet.title}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                id="btn-copy-code"
                onClick={handleCopyCode}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>

              <button
                id="btn-download-code"
                onClick={handleDownloadCode}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                title="Download file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>
          </div>

          {/* Description Card */}
          <div className="px-5 py-2.5 bg-slate-900/30 border-b border-slate-800/80 text-xs text-slate-400">
            <span className="text-slate-300 font-medium">Purpose: </span>
            {activeSnippet.description}
          </div>

          {/* Code Window with Syntax and Line Numbers */}
          <div className="p-4 overflow-x-auto max-h-[520px] font-mono text-xs text-slate-300 scrollbar-thin">
            <pre className="whitespace-pre leading-relaxed">
              <code>{activeSnippet.content}</code>
            </pre>
          </div>

        </div>

      </div>
    </div>
  );
};
