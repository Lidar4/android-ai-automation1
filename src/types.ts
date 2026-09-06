export type RiskTier = "LOW_SAFE" | "MEDIUM_CONFIRM" | "HIGH_DESTRUCTIVE";

export interface ToolCallItem {
  name: string;
  args: Record<string, any>;
  description: string;
  riskTier: RiskTier;
  requiresBiometricOrConfirmation: boolean;
  shizukuCommand: string;
  accessibilityFallback: string;
}

export interface ActionPreviewItem {
  id: string;
  tool: string;
  displayName: string;
  arguments: Record<string, any>;
  description: string;
  requiredPermission: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  requiresConfirmation: boolean;
  androidContract?: {
    nativeApi: string;
    requiredPermission: string;
    minSdkVersion: number;
    fallbackIntent?: string;
    description: string;
  };
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
  toolCalls?: ToolCallItem[];
  actionPreview?: ActionPreviewItem;
  executionStatus?: "pending" | "confirmed" | "executing" | "completed" | "failed" | "cancelled";
  executionLogs?: string[];
  source?: "android" | "simulator";
}

export interface DeviceState {
  brightness: number; // 0 to 100
  wifi: boolean;
  bluetooth: boolean;
  volume: number; // 0 to 100
  batterySaver: boolean;
  batteryLevel: number;
  flashlight: boolean;
  dnd: boolean;
  airplaneMode?: boolean;
  screenLocked?: boolean;
  appCaches: {
    name: string;
    packageName: string;
    cacheSizeMb: number;
  }[];
  shizukuConnected: boolean;
  accessibilityEnabled: boolean;
  rootGranted?: boolean;
  allAccessMode?: boolean;
}

export interface ExecutionLog {
  id: string;
  timestamp: string;
  engine: "SHIZUKU" | "ACCESSIBILITY" | "NATIVE_INTENT" | "ROOT_SHELL" | "ANDROID_BRIDGE" | "SIMULATOR";
  command: string;
  status: "SUCCESS" | "WARNING" | "BLOCKED" | "FAILED";
  details: string;
  durationMs: number;
}

export interface CodeSnippet {
  id: string;
  title: string;
  filename: string;
  language: "kotlin" | "dart" | "xml" | "groovy" | "json";
  category: "kotlin" | "flutter" | "manifest" | "gradle";
  description: string;
  content: string;
}

export interface DeviceSessionStatus {
  deviceConnected: boolean;
  mode: "REAL_DEVICE" | "SIMULATOR";
  platform: string;
  bridgeAvailable: boolean;
  batteryLevel?: number;
  lastHeartbeat: string;
}
