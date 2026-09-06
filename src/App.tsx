import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { PhoneSimulator } from "./components/PhoneSimulator";
import { ChatAssistant } from "./components/ChatAssistant";
import { ArchitectureDiagram } from "./components/ArchitectureDiagram";
import { CodeViewer } from "./components/CodeViewer";
import { SafetySecurityGuide } from "./components/SafetySecurityGuide";
import { ExecutionTerminal } from "./components/ExecutionTerminal";
import { ProjectExporter } from "./components/ProjectExporter";
import { SettingsView } from "./components/SettingsView";
import { DeviceState, ExecutionLog } from "./types";
import { Layers, Smartphone, Code2, ShieldCheck, Cpu, Sparkles } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"simulator" | "project" | "architecture" | "code" | "guides" | "settings">("simulator");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [lastActionMessage, setLastActionMessage] = useState<string>("");

  // Simulated Android Device State
  const [deviceState, setDeviceState] = useState<DeviceState>({
    brightness: 70,
    wifi: true,
    bluetooth: true,
    volume: 60,
    batterySaver: false,
    batteryLevel: 68,
    flashlight: false,
    dnd: false,
    appCaches: [
      { name: "TikTok", packageName: "com.zhiliaoapp.musically", cacheSizeMb: 1420 },
      { name: "Instagram", packageName: "com.instagram.android", cacheSizeMb: 850 },
      { name: "YouTube", packageName: "com.google.android.youtube", cacheSizeMb: 610 },
    ],
    shizukuConnected: true,
    accessibilityEnabled: true,
  });

  // Real-time execution logs
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([
    {
      id: "log-init-1",
      timestamp: "09:40:01",
      engine: "SHIZUKU",
      status: "SUCCESS",
      command: "shizuku.pingBinder() -> UID 2000 (shell)",
      details: "Wireless debugging IPC daemon connected on 127.0.0.1:5555",
      durationMs: 12,
    },
    {
      id: "log-init-2",
      timestamp: "09:40:02",
      engine: "ACCESSIBILITY",
      status: "SUCCESS",
      command: "AutomationAccessibilityService.onServiceConnected()",
      details: "Fallback UI automation engine active and bound",
      durationMs: 45,
    },
  ]);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(data.hasApiKey);
      })
      .catch((err) => console.error("Status fetch error:", err));
  }, []);

  const addExecutionLog = (log: Omit<ExecutionLog, "id" | "timestamp">) => {
    const newLog: ExecutionLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      ...log,
    };
    setExecutionLogs((prev) => [newLog, ...prev]);
  };

  const handleClearLogs = () => {
    setExecutionLogs([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasApiKey={hasApiKey}
        shizukuConnected={deviceState.shizukuConnected}
        accessibilityEnabled={deviceState.accessibilityEnabled}
      />

      {/* Main Workspace Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "simulator" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Top Explanatory Banner */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
                    Live Testbed
                  </span>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-xs text-slate-300">
                    Natural Language Problem → Gemini Function Calling → Android Execution
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Try typing or clicking a problem below like <span className="text-emerald-300 font-mono">"My screen is blinding me in bed"</span> or <span className="text-emerald-300 font-mono">"TikTok is lagging, clear cache"</span>. Watch the AI formulate tool calls and observe the simulated Android device update in real-time.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => setActiveTab("project")}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 transition-all shadow-md shadow-emerald-500/20 flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>All Access & Project ZIP</span>
                </button>
                <button
                  onClick={() => setActiveTab("code")}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors flex items-center space-x-1.5 border border-slate-700"
                >
                  <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Kotlin & Flutter Code</span>
                </button>
              </div>
            </div>

            {/* Split Grid: Chat Assistant on Left, Phone Simulator on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7">
                <ChatAssistant
                  deviceState={deviceState}
                  setDeviceState={setDeviceState}
                  addLog={addExecutionLog}
                  setLastActionMessage={setLastActionMessage}
                />
              </div>

              <div className="lg:col-span-5 flex justify-center">
                <PhoneSimulator
                  deviceState={deviceState}
                  setDeviceState={setDeviceState}
                  lastActionMessage={lastActionMessage}
                />
              </div>
            </div>

            {/* Real-time Execution Terminal */}
            <ExecutionTerminal
              logs={executionLogs}
              onClearLogs={handleClearLogs}
            />
          </div>
        )}

        {activeTab === "project" && (
          <div className="animate-fadeIn">
            <ProjectExporter />
          </div>
        )}

        {activeTab === "architecture" && (
          <div className="animate-fadeIn">
            <ArchitectureDiagram />
          </div>
        )}

        {activeTab === "code" && (
          <div className="animate-fadeIn">
            <CodeViewer />
          </div>
        )}

        {activeTab === "guides" && (
          <div className="animate-fadeIn">
            <SafetySecurityGuide />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="animate-fadeIn">
            <SettingsView />
          </div>
        )}
      </main>

      {/* Global Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Android AI Automation Architecture & Boilerplate • Powered by Gemini 3.8 Flash & Shizuku
          </span>
          <span className="font-mono text-[11px] text-slate-600">
            Compliant with Android 11–15 Wireless Debugging & Accessibility Policies
          </span>
        </div>
      </footer>
    </div>
  );
}
