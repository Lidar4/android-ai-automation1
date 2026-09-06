import { AllowlistedToolDefinition, ALLOWLISTED_TOOLS } from "../data/allowlistedTools";
import { DeviceState } from "../types";

declare global {
  interface Window {
    androidBridge?: {
      execute?: (tool: string, jsonArgs: string | Record<string, any>) => string | Promise<string>;
      isDeviceConnected?: () => boolean;
      getDeviceInfo?: () => string;
      setSmsAutoReply?: (enabled: boolean, template: string, senderFilter: string) => string;
      getSmsAutoReply?: () => string;
      postMessage?: (message: string) => void;
    };
  }
}

export interface AndroidBridgeResponse {
  success: boolean;
  tool: string;
  message: string;
  source: "android" | "simulator";
  errorCode?: string;
  data?: Record<string, any>;
  timestamp?: string;
}

export interface DeviceSessionStatus {
  deviceConnected: boolean;
  mode: "REAL_DEVICE" | "SIMULATOR";
  platform: string;
  bridgeAvailable: boolean;
  batteryLevel?: number;
  lastHeartbeat: string;
}

class AndroidBridgeClient {
  public isBridgeAvailable(): boolean {
    return typeof window !== "undefined" && !!window.androidBridge && typeof window.androidBridge.execute === "function";
  }

  public isDeviceConnected(): boolean {
    if (this.isBridgeAvailable() && typeof window.androidBridge?.isDeviceConnected === "function") {
      try { return window.androidBridge.isDeviceConnected(); } catch (_) { return true; }
    }
    return this.isBridgeAvailable();
  }

  public getDeviceInfo(): Record<string, any> | null {
    if (this.isBridgeAvailable() && typeof window.androidBridge?.getDeviceInfo === "function") {
      try {
        const raw = window.androidBridge.getDeviceInfo();
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (_) { return null; }
    }
    return null;
  }

  /** Local SMS automation rule. Disabled by default and requires Android permissions. */
  public setSmsAutoReply(enabled: boolean, template: string, senderFilter = ""): Record<string, any> {
    if (!this.isBridgeAvailable() || typeof window.androidBridge?.setSmsAutoReply !== "function") {
      return { success: false, errorCode: "NATIVE_BRIDGE_UNAVAILABLE", message: "SMS automation is available only in the Android APK." };
    }
    try { return JSON.parse(window.androidBridge.setSmsAutoReply(enabled, template, senderFilter)); }
    catch (e: any) { return { success: false, errorCode: "BRIDGE_ERROR", message: e?.message || "Could not save SMS automation." }; }
  }

  public getSmsAutoReply(): Record<string, any> {
    if (!this.isBridgeAvailable() || typeof window.androidBridge?.getSmsAutoReply !== "function") {
      return { enabled: false, template: "", senderFilter: "" };
    }
    try { return JSON.parse(window.androidBridge.getSmsAutoReply()); }
    catch (_) { return { enabled: false, template: "", senderFilter: "" }; }
  }

  public getStatus(): DeviceSessionStatus {
    const bridgeAvailable = this.isBridgeAvailable();
    return { deviceConnected: bridgeAvailable ? this.isDeviceConnected() : false, mode: bridgeAvailable ? "REAL_DEVICE" : "SIMULATOR", platform: bridgeAvailable ? "Android Native APK (WebView Bridge)" : "Web Browser (Simulator Mode)", bridgeAvailable, lastHeartbeat: new Date().toISOString() };
  }

  public async execute(tool: string, args: Record<string, any>, currentDeviceState?: DeviceState, updateDeviceState?: (updater: (prev: DeviceState) => DeviceState) => void): Promise<AndroidBridgeResponse> {
    return this.executeAction(tool, args, currentDeviceState, updateDeviceState);
  }

  public async executeAction(tool: string, args: Record<string, any>, currentDeviceState?: DeviceState, updateDeviceState?: (updater: (prev: DeviceState) => DeviceState) => void): Promise<AndroidBridgeResponse> {
    const toolDef = ALLOWLISTED_TOOLS[tool];
    if (!toolDef) return { success: false, tool, message: `Action '${tool}' is not in the security allowlist. Arbitrary executions are strictly forbidden.`, source: this.isBridgeAvailable() ? "android" : "simulator", errorCode: "SECURITY_TOOL_NOT_ALLOWLISTED", timestamp: new Date().toISOString() };

    if (this.isBridgeAvailable()) {
      try {
        const rawResponse = window.androidBridge!.execute!(tool, JSON.stringify(args));
        const resolved = rawResponse instanceof Promise ? await rawResponse : rawResponse;
        const parsed: AndroidBridgeResponse = typeof resolved === "string" ? JSON.parse(resolved) : resolved;
        return { ...parsed, source: "android", timestamp: new Date().toISOString() };
      } catch (err: any) {
        return { success: false, tool, message: `Android Native Bridge Execution Error: ${err?.message || "Unknown error"}`, source: "android", errorCode: "BRIDGE_EXECUTION_EXCEPTION", timestamp: new Date().toISOString() };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    if (updateDeviceState) {
      switch (tool) {
        case "set_brightness": updateDeviceState((prev) => ({ ...prev, brightness: Math.min(100, Math.max(1, Number(args.level) || 50)) })); break;
        case "set_volume": updateDeviceState((prev) => ({ ...prev, volume: Math.min(100, Math.max(0, Number(args.level) || 50)) })); break;
        case "toggle_flashlight": updateDeviceState((prev) => ({ ...prev, flashlight: !!args.enabled })); break;
        case "toggle_battery_saver": updateDeviceState((prev) => ({ ...prev, batterySaver: !!args.enabled })); break;
        case "toggle_do_not_disturb": updateDeviceState((prev) => ({ ...prev, dnd: !!args.enabled })); break;
        case "clear_own_cache": updateDeviceState((prev) => ({ ...prev, appCaches: prev.appCaches.map((c) => (c.name === "TikTok" ? { ...c, cacheSizeMb: 0 } : c)) })); break;
      }
    }
    return { success: true, tool, message: `Simulated '${toolDef.displayName}' executed successfully. [Simulation Only — no real device change].`, source: "simulator", timestamp: new Date().toISOString(), data: { tool, args, simulated: true, note: "In Android APK, this invokes native Android API: " + toolDef.androidContract.nativeApi } };
  }
}

export const androidBridge = new AndroidBridgeClient();
