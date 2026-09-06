import React, { useState } from "react";
import { 
  Layers, 
  Cpu, 
  ShieldCheck, 
  Terminal, 
  Smartphone, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  HelpCircle,
  Zap,
  Radio,
  Eye
} from "lucide-react";

interface LayerDetail {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  icon: any;
  components: string[];
  responsibilities: string[];
  securityNotes: string;
  codeSnippetPreview: string;
}

export const ArchitectureDiagram: React.FC = () => {
  const [selectedLayer, setSelectedLayer] = useState<string>("layer-ai");

  const layers: LayerDetail[] = [
    {
      id: "layer-ui",
      name: "1. Presentation & Voice Intake Layer",
      subtitle: "Jetpack Compose / Flutter Widget Tree",
      color: "emerald",
      icon: Smartphone,
      components: [
        "AssistantScreen.kt (Compose)",
        "VoiceInputListener (Android SpeechRecognizer)",
        "ConfirmationModal (BiometricPrompt trigger)",
        "QuickSettingsTileService (Notification shade tile)"
      ],
      responsibilities: [
        "Captures user speech or typed natural language description of their phone issue",
        "Presents real-time status, loading indicators, and pending confirmation dialogs",
        "Directly integrates with Android 11+ system dark mode and theme dynamics"
      ],
      securityNotes: "Never collects or logs sensitive passwords. Enforces Android RECORD_AUDIO runtime permission check.",
      codeSnippetPreview: `// Jetpack Compose Voice Intake
IconButton(onClick = { speechRecognizer.startListening(intent) }) {
    Icon(Icons.Default.Mic, contentDescription = "Voice Input")
}`
    },
    {
      id: "layer-orchestration",
      name: "2. Orchestration & State Flow",
      subtitle: "AssistantViewModel & Coroutines",
      color: "cyan",
      icon: Layers,
      components: [
        "AssistantViewModel.kt",
        "UiState: StateFlow<AssistantUiState>",
        "ActionQueue & UndoSnapshotManager",
        "DeviceHardwareProbe"
      ],
      responsibilities: [
        "Maintains single source of truth for conversational history and device state",
        "Dispatches prompt to Gemini Service asynchronously on Dispatchers.IO",
        "Sequences multi-step automations (e.g. Turn off Wi-Fi -> Dim screen -> Turn on Battery Saver)",
        "Maintains rollback snapshots of system settings prior to modification"
      ],
      securityNotes: "Cleans up CoroutineJobs on ViewModel lifecycle teardown; blocks recursive automated loops.",
      codeSnippetPreview: `// ViewModel Coroutine Orchestration
fun onPrompt(text: String) = viewModelScope.launch(Dispatchers.IO) {
    val aiResult = geminiService.process(text)
    safetyGatekeeper.evaluate(aiResult.actions)
}`
    },
    {
      id: "layer-ai",
      name: "3. AI Reasoning & Function Calling",
      subtitle: "Google GenAI SDK (Gemini 3.8 Flash)",
      color: "purple",
      icon: Cpu,
      components: [
        "GeminiAutomationService.kt",
        "FunctionDeclaration Registry",
        "SchemaType Builder",
        "ToolCall Parser"
      ],
      responsibilities: [
        "Registers strictly typed tools: adjust_brightness, toggle_wifi, clear_app_cache, set_volume, toggle_battery_saver",
        "Translates ambiguous complaints ('My phone is burning up') into concrete system actions (enable power saver, kill background apps)",
        "Guarantees deterministic arguments using Type.OBJECT, Type.INTEGER, Type.BOOLEAN schemas"
      ],
      securityNotes: "Enforces strict parameter schemas. Disallows raw arbitrary bash execution tools.",
      codeSnippetPreview: `val brightnessTool = FunctionDeclaration.builder()
    .name("adjust_brightness")
    .parameters(Schema.builder().putProperty("level", Type.INTEGER).build())
    .build()`
    },
    {
      id: "layer-security",
      name: "4. Safety Gatekeeper & Policy Filter",
      subtitle: "BiometricPrompt & Risk Classification",
      color: "amber",
      icon: ShieldCheck,
      components: [
        "SafetyGatekeeper.kt",
        "RiskTier Evaluator (Tier 1 to 4)",
        "BiometricPrompt Bridge",
        "Command Whitelist Validator",
        "Audit Log Store"
      ],
      responsibilities: [
        "Intercepts all tool calls BEFORE they touch device hardware or Android APIs",
        "Classifies actions: Tier 1 (Auto-execute), Tier 2 (Connectivity), Tier 3 (Destructive/Biometric prompt), Tier 4 (Forbidden)",
        "Blocks malicious jailbreak prompts like 'wipe my device' or 'read SMS'",
        "Requires fingerprint, face recognition, or PIN for app cache clearing and process killing"
      ],
      securityNotes: "Biometric authentication is validated against Android hardware Keystore/TEE (KeyMaster).",
      codeSnippetPreview: `if (risk == RiskLevel.TIER_3_DESTRUCTIVE) {
    biometricPrompt.authenticate(promptInfo)
} else {
    executor.execute(action)
}`
    },
    {
      id: "layer-execution",
      name: "5. Device Drivers & Execution Bridge",
      subtitle: "Shizuku ADB IPC & AccessibilityService",
      color: "emerald",
      icon: Terminal,
      components: [
        "ShizukuCommandExecutor.kt (dev.rikka.shizuku)",
        "AutomationAccessibilityService.kt",
        "SystemSettings Bridge (Settings.System)",
        "AudioManager & CameraManager Native APIs"
      ],
      responsibilities: [
        "Option A (Preferred): Shizuku remote process executes ADB shell commands (UID 2000) via local binder IPC",
        "Option B (Fallback): AccessibilityService inspects view hierarchy trees and performs synthetic gestures/clicks",
        "Option C: Android SDK standard APIs with standard permissions"
      ],
      securityNotes: "Shizuku runs sandboxed under ADB permissions (no root required); Accessibility follows Google Play disclosures.",
      codeSnippetPreview: `// Shizuku Remote Process Execution
val process = Shizuku.newProcess(arrayOf("sh", "-c", cmd), null, null)
val exitCode = process.waitFor()`
    }
  ];

  const currentLayer = layers.find((l) => l.id === selectedLayer) || layers[2];

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-3">
            <Zap className="w-3.5 h-3.5" />
            <span>5-Layer Android AI Automation Architecture</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">
            How Natural Language Translates to Privileged Android System Control
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Unrooted Android devices restrict standard applications from toggling Wi-Fi (since Android 10) or clearing another app's cache. By combining <strong className="text-slate-200">Gemini Function Calling</strong> with <strong className="text-emerald-400">Shizuku (Wireless Debugging ADB IPC)</strong> and an <strong className="text-cyan-400">Accessibility Service fallback</strong>, your assistant securely executes system-level remediations while a <strong className="text-amber-400">Safety Gatekeeper</strong> prevents unauthorized modifications.
          </p>
        </div>
      </div>

      {/* Visual Pipeline Stack */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {layers.map((layer, index) => {
          const Icon = layer.icon;
          const isSelected = layer.id === selectedLayer;
          return (
            <div
              key={layer.id}
              onClick={() => setSelectedLayer(layer.id)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all relative flex flex-col justify-between ${
                isSelected
                  ? "bg-slate-800/90 border-emerald-500 shadow-lg shadow-emerald-500/10 scale-[1.02]"
                  : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    Step {index + 1}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isSelected ? "bg-emerald-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <h4 className="text-xs font-bold text-slate-200 leading-tight">
                  {layer.name.replace(/^\d+\.\s*/, "")}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {layer.subtitle}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                <span className={isSelected ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                  {isSelected ? "Inspecting" : "Click to view"}
                </span>
                <ArrowRight className={`w-3 h-3 ${isSelected ? "text-emerald-400" : "text-slate-600"}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Layer Detail Deep Dive */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Responsibilities & Components */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <currentLayer.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">{currentLayer.name}</h3>
              <p className="text-xs text-slate-400">{currentLayer.subtitle}</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Key Responsibilities
            </h4>
            <ul className="space-y-1.5">
              {currentLayer.responsibilities.map((r, i) => (
                <li key={i} className="text-xs text-slate-300 flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Architectural Modules & Classes
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {currentLayer.components.map((c, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2.5">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Security & Sandbox Constraint</span>
              <span className="text-[11px] text-amber-200/90">{currentLayer.securityNotes}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Code Snippet Preview */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Implementation Blueprint</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">Production Kotlin</span>
          </div>

          <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 p-4 font-mono text-xs text-slate-200 overflow-x-auto">
            <pre className="whitespace-pre-wrap leading-relaxed text-[11px]">
              {currentLayer.codeSnippetPreview}
            </pre>
          </div>
        </div>

      </div>

      {/* Comparison: Shizuku vs Accessibility Service */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6">
        <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center space-x-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Execution Engine Comparison: Shizuku (ADB) vs Accessibility Service</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Shizuku Card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 text-sm">Shizuku (Recommended Primary)</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                UID 2000 (shell)
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Operates by binding to a privileged background process launched via Android's local Wireless Debugging daemon. Grants direct access to system commands (<code className="text-emerald-300">cmd connectivity</code>, <code className="text-emerald-300">settings put</code>, <code className="text-emerald-300">pm trim-caches</code>).
            </p>
            <div className="space-y-1 text-slate-400 text-[11px]">
              <div className="flex items-center space-x-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Silent background execution (no UI screen flickering or app opening)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>High execution speed (&lt;100ms per system command)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-amber-400 font-bold">!</span>
                <span>Requires user to pair Wireless Debugging once after device reboot</span>
              </div>
            </div>
          </div>

          {/* Accessibility Service Card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-400 text-sm">Accessibility Service (Fallback)</span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px]">
                UI Node Traversal
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Subclasses Android's <code className="text-cyan-300">AccessibilityService</code>. Traverses the on-screen view hierarchy to find buttons ('Storage', 'Clear cache', Quick Settings tiles) and dispatches synthetic click events.
            </p>
            <div className="space-y-1 text-slate-400 text-[11px]">
              <div className="flex items-center space-x-1.5">
                <span className="text-cyan-400 font-bold">✓</span>
                <span>Works on 100% of unrooted Android devices without pairing codes</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-amber-400 font-bold">!</span>
                <span>Visually opens screens and clicks buttons; prone to OEM skin changes (OneUI, MIUI)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-amber-400 font-bold">!</span>
                <span>Requires strict Google Play Prominent Disclosure to avoid store policy rejection</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
