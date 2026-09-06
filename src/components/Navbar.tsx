import React, { useState, useEffect } from "react";
import { 
  Bot, 
  Smartphone, 
  Code2, 
  ShieldCheck, 
  Cpu, 
  Sparkles,
  Layers,
  Radio,
  Info,
  CheckCircle2,
  X,
  Settings
} from "lucide-react";
import { androidBridge } from "../services/androidBridge";

interface NavbarProps {
  activeTab: "simulator" | "project" | "architecture" | "code" | "guides" | "settings";
  setActiveTab: (tab: "simulator" | "project" | "architecture" | "code" | "guides" | "settings") => void;
  hasApiKey: boolean;
  shizukuConnected: boolean;
  accessibilityEnabled: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  hasApiKey,
  shizukuConnected,
  accessibilityEnabled,
}) => {
  const [isRealDevice, setIsRealDevice] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  useEffect(() => {
    setIsRealDevice(androidBridge.isBridgeAvailable());
  }, []);

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 shrink-0">
            <Bot className="w-5 h-5 font-bold stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="font-semibold text-slate-100 text-sm sm:text-base tracking-tight font-sans">
                DroidAutomate AI
              </span>
              <button
                onClick={() => setShowStatusModal(true)}
                className={`px-2 py-0.5 text-[10px] sm:text-[11px] font-medium rounded-full border flex items-center space-x-1 transition-all ${
                  isRealDevice
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                    : "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20"
                }`}
                title={isRealDevice ? "Android Native Bridge Connected" : "Simulation only — no real device change"}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isRealDevice ? "bg-emerald-400 animate-ping" : "bg-cyan-400"}`} />
                <span>{isRealDevice ? "REAL DEVICE MODE" : "SIMULATOR MODE"}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block truncate max-w-md">
              AI decides WHAT → Android validates WHETHER/HOW → Android executes allowed action
            </p>
          </div>
        </div>

        {/* Tab Navigation - touch-friendly and horizontally scrollable on mobile WebView */}
        <nav className="flex items-center space-x-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800/80 overflow-x-auto scrollbar-none max-w-[55vw] sm:max-w-none">
          <button
            id="nav-tab-simulator"
            onClick={() => setActiveTab("simulator")}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === "simulator"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span>Simulator</span>
          </button>

          <button
            id="nav-tab-project"
            onClick={() => setActiveTab("project")}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === "project"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Project ZIP</span>
          </button>

          <button
            id="nav-tab-architecture"
            onClick={() => setActiveTab("architecture")}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === "architecture"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Architecture</span>
          </button>

          <button
            id="nav-tab-code"
            onClick={() => setActiveTab("code")}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === "code"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Code2 className="w-3.5 h-3.5 shrink-0" />
            <span>Code</span>
          </button>

          <button
            id="nav-tab-guides"
            onClick={() => setActiveTab("guides")}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === "guides"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Safety</span>
          </button>

          <button
            id="nav-tab-settings"
            onClick={() => setActiveTab("settings")}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === "settings"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Settings className="w-3.5 h-3.5 shrink-0" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Status Indicators */}
        <div className="hidden lg:flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px]">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300 font-mono">Gemini 3.8 Flash</span>
          </div>

          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
              isRealDevice
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isRealDevice ? "Bridge Active" : "Web Simulator"}</span>
          </div>
        </div>
      </div>

      {/* Diagnostics / Mode Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Info className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-semibold text-slate-100">Environment & Bridge Status</h3>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Current Mode:</span>
                  <span className={`font-mono font-bold ${isRealDevice ? "text-emerald-400" : "text-cyan-400"}`}>
                    {isRealDevice ? "REAL DEVICE MODE" : "SIMULATOR MODE"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Android Bridge:</span>
                  <span className="font-mono text-slate-300">
                    {isRealDevice ? "Injected (window.androidBridge)" : "Unavailable (Browser Environment)"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Security Rule:</span>
                  <span className="text-slate-300 font-mono">Allowlist Tool Registry Only</span>
                </div>
              </div>

              {!isRealDevice ? (
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/50 text-cyan-300 text-[11px] leading-relaxed">
                  <strong>Notice:</strong> You are currently in <strong>Simulator Mode</strong>. Actions modify the simulated phone screen for safe preview.
                  <div className="mt-1 font-mono text-[10px] text-cyan-400">
                    "Simulation only — no real device change."
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-[11px] leading-relaxed">
                  <strong>Active Bridge:</strong> Application is running inside the companion Android APK WebView. Actions will execute on the real Android device via native APIs!
                </div>
              )}
            </div>

            <button
              onClick={() => setShowStatusModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
