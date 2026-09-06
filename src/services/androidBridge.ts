import { AllowlistedToolDefinition, ALLOWLISTED_TOOLS } from "../data/allowlistedTools";
import { DeviceState } from "../types";

declare global {
  interface Window {
    androidBridge?: {
      execute?: (tool: string, jsonArgs: string | Record<string, any>) => string | Promise<string>;
      isDeviceConnected?: () => boolean;
      getDeviceInfo?: () => string;
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
  /**
   * Check if running inside Android APK with native JavascriptInterface bridge injected
   */
  public isBridgeAvailable(): boolean {
    return (
      typeof window !== "undefined" &&
      !!window.androidBridge &&
      typeof window.androidBridge.execute === "function"
    );
  }

  /**
   * Queries real device connection status from native bridge if available
   */
  public isDeviceConnected(): boolean {
    if (this.isBridgeAvailable() && typeof window.androidBridge?.isDeviceConnected === "function") {
      try {
        return window.androidBridge.isDeviceConnected();
      } catch (e) {
        return true;
      }
    }
    return this.isBridgeAvailable();
  }

  /**
   * Reads hardware/OS specifications from native bridge if available
   */
  public getDeviceInfo(): Record<string, any> | null {
    if (this.isBridgeAvailable() && typeof window.androidBridge?.getDeviceInfo === "function") {
      try {
        const raw = window.androidBridge.getDeviceInfo();
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Detect current operational mode
   */
  public getStatus(): DeviceSessionStatus {
    const bridgeAvailable = this.isBridgeAvailable();
    return {
      deviceConnected: bridgeAvailable ? this.isDeviceConnected() : false,
      mode: bridgeAvailable ? "REAL_DEVICE" : "SIMULATOR",
      platform: bridgeAvailable ? "Android Native APK (WebView Bridge)" : "Web Browser (Simulator Mode)",
      bridgeAvailable,
      lastHeartbeat: new Date().toISOString(),
    };
  }

  /**
   * Primary Execution Method:
   * Rule: "AI decides WHAT -> Android validates WHETHER/HOW -> Android executes allowed action."
   * If running inside Android APK: Dispatches to window.androidBridge.execute(...)
   * If running in Web Browser: Dispatches to simulated state with explicit disclaimer.
   */
  public async execute(
    tool: string,
    args: Record<string, any>,
    currentDeviceState?: DeviceState,
    updateDeviceState?: (updater: (prev: DeviceState) => DeviceState) => void
  ): Promise<AndroidBridgeResponse> {
    return this.executeAction(tool, args, currentDeviceState, updateDeviceState);
  }

  public async executeAction(
    tool: string,
    args: Record<string, any>,
    currentDeviceState?: DeviceState,
    updateDeviceState?: (updater: (prev: DeviceState) => DeviceState) => void
  ): Promise<AndroidBridgeResponse> {
    const toolDef = ALLOWLISTED_TOOLS[tool];

    // Security Gate 1: Check Allowlist
    if (!toolDef) {
      return {
        success: false,
        tool,
        message: `Action '${tool}' is not in the security allowlist. Arbitrary executions are strictly forbidden.`,
        source: this.isBridgeAvailable() ? "android" : "simulator",
        errorCode: "SECURITY_TOOL_NOT_ALLOWLISTED",
        timestamp: new Date().toISOString(),
      };
    }

    // Path A: Real Device Execution via native Android APK Bridge
    if (this.isBridgeAvailable()) {
      try {
        const jsonArgString = typeof args === "string" ? args : JSON.stringify(args);
        const rawResponse = window.androidBridge!.execute!(tool, jsonArgString);
        const resolved = rawResponse instanceof Promise ? await rawResponse : rawResponse;
        const parsed: AndroidBridgeResponse =
          typeof resolved === "string" ? JSON.parse(resolved) : resolved;
        return {
          ...parsed,
          source: "android",
          timestamp: new Date().toISOString(),
        };
      } catch (err: any) {
        return {
          success: false,
          tool,
          message: `Android Native Bridge Execution Error: ${err?.message || "Unknown error"}`,
          source: "android",
          errorCode: "BRIDGE_EXECUTION_EXCEPTION",
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Path B: Web Browser Simulator Mode
    // Clearly marks result as Simulation only — no real device change.
    await new Promise((resolve) => setTimeout(resolve, 300)); // Realistic latency

    if (updateDeviceState) {
      switch (tool) {
        case "set_brightness": {
          const lvl = Number(args.level) || 50;
          updateDeviceState((prev) => ({ ...prev, brightness: Math.min(100, Math.max(1, lvl)) }));
          break;
        }
        case "open_wifi_settings": {
          break;
        }
        case "open_bluetooth_settings": {
          break;
        }
        case "open_app_settings": {
          break;
        }
        case "set_volume": {
          const vol = Number(args.level) || 50;
          updateDeviceState((prev) => ({ ...prev, volume: Math.min(100, Math.max(0, vol)) }));
          break;
        }
        case "toggle_flashlight": {
          updateDeviceState((prev) => ({ ...prev, flashlight: !!args.enabled }));
          break;
        }
        case "toggle_battery_saver": {
          updateDeviceState((prev) => ({ ...prev, batterySaver: !!args.enabled }));
          break;
        }
        case "toggle_do_not_disturb": {
          updateDeviceState((prev) => ({ ...prev, dnd: !!args.enabled }));
          break;
        }
        case "clear_own_cache": {
          updateDeviceState((prev) => ({
            ...prev,
            appCaches: prev.appCaches.map((c) => (c.name === "TikTok" ? { ...c, cacheSizeMb: 0 } : c)),
          }));
          break;
        }
      }
    }

    return {
      success: true,
      tool,
      message: `Simulated '${toolDef.displayName}' executed successfully. [Simulation Only — no real device change].`,
      source: "simulator",
      timestamp: new Date().toISOString(),
      data: {
        tool,
        args,
        simulated: true,
        note: "In Android APK, this invokes native Android API: " + toolDef.androidContract.nativeApi,
      },
    };
  }
}

export const androidBridge = new AndroidBridgeClient();
