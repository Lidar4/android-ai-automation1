/**
 * Central Action Validator & Strict Allowlist Registry
 *
 * Core Security Invariant:
 * AI DECIDES WHAT.
 * VALIDATOR DECIDES WHETHER IT IS ALLOWED.
 * ANDROID DECIDES HOW TO EXECUTE IT.
 *
 * The AI must NEVER directly execute arbitrary commands.
 */

export interface AllowlistedToolMeta {
  name: string;
  displayName: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  requiredPermission: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  requiresConfirmation: boolean;
  androidContract: {
    nativeApi: string;
    requiredPermission: string;
    minSdkVersion: number;
    fallbackIntent?: string;
    description: string;
  };
}

export const ALLOWLISTED_TOOLS_REGISTRY: Record<string, AllowlistedToolMeta> = {
  set_brightness: {
    name: "set_brightness",
    displayName: "Set Screen Brightness",
    description: "Sets the screen display brightness level to an integer percentage between 1 and 100.",
    parameters: {
      type: "object",
      properties: {
        level: {
          type: "integer",
          description: "Brightness percentage level (1 to 100).",
          minimum: 1,
          maximum: 100,
        },
      },
      required: ["level"],
    },
    requiredPermission: "android.permission.WRITE_SETTINGS",
    riskLevel: "LOW",
    requiresConfirmation: false,
    androidContract: {
      nativeApi: "Settings.System.putInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS, (level * 255) / 100)",
      requiredPermission: "android.permission.WRITE_SETTINGS",
      minSdkVersion: 21,
      fallbackIntent: "Intent(Settings.ACTION_DISPLAY_SETTINGS)",
      description: "Directly sets system brightness if WRITE_SETTINGS is granted, or opens Display Settings.",
    },
  },

  open_wifi_settings: {
    name: "open_wifi_settings",
    displayName: "Open Wi-Fi Settings",
    description: "Opens the official Android Wi-Fi settings or Panel for safe user selection.",
    parameters: {
      type: "object",
      properties: {},
    },
    requiredPermission: "none",
    riskLevel: "LOW",
    requiresConfirmation: false,
    androidContract: {
      nativeApi: "Intent(Settings.Panel.ACTION_WIFI) or Intent(Settings.ACTION_WIFI_SETTINGS)",
      requiredPermission: "none",
      minSdkVersion: 29,
      fallbackIntent: "Intent(Settings.ACTION_WIFI_SETTINGS)",
      description: "Launches Android 10+ Wi-Fi Internet Panel safely without system-app restrictions.",
    },
  },

  open_bluetooth_settings: {
    name: "open_bluetooth_settings",
    displayName: "Open Bluetooth Settings",
    description: "Opens the official Android Bluetooth management screen or Settings panel.",
    parameters: {
      type: "object",
      properties: {},
    },
    requiredPermission: "none",
    riskLevel: "LOW",
    requiresConfirmation: false,
    androidContract: {
      nativeApi: "Intent(Settings.ACTION_BLUETOOTH_SETTINGS)",
      requiredPermission: "none",
      minSdkVersion: 21,
      fallbackIntent: "Intent(Settings.ACTION_BLUETOOTH_SETTINGS)",
      description: "Opens system Bluetooth configuration screen to pair devices or toggle connectivity.",
    },
  },

  open_app_settings: {
    name: "open_app_settings",
    displayName: "Open App Settings",
    description: "Opens Application Details in Android Settings to manage permissions or storage.",
    parameters: {
      type: "object",
      properties: {
        package_name: {
          type: "string",
          description: "Optional package name (e.g. com.google.android.youtube). If empty, opens current app settings.",
        },
      },
    },
    requiredPermission: "none",
    riskLevel: "LOW",
    requiresConfirmation: false,
    androidContract: {
      nativeApi: "Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse('package:' + pkg))",
      requiredPermission: "none",
      minSdkVersion: 21,
      fallbackIntent: "Intent(Settings.ACTION_MANAGE_APPLICATIONS_SETTINGS)",
      description: "Safely opens target app system info page allowing user to clear cache or manage permissions.",
    },
  },

  set_volume: {
    name: "set_volume",
    displayName: "Set Audio Volume",
    description: "Sets the device audio stream volume to an integer percentage between 0 and 100.",
    parameters: {
      type: "object",
      properties: {
        level: {
          type: "integer",
          description: "Volume percentage level (0 to 100).",
          minimum: 0,
          maximum: 100,
        },
        stream_type: {
          type: "string",
          description: "Target audio stream: 'music', 'ring', 'alarm', or 'notification'. Default is 'music'.",
          enum: ["music", "ring", "alarm", "notification"],
        },
      },
      required: ["level"],
    },
    requiredPermission: "none",
    riskLevel: "LOW",
    requiresConfirmation: false,
    androidContract: {
      nativeApi: "audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, (level * maxVol) / 100, AudioManager.FLAG_SHOW_UI)",
      requiredPermission: "none",
      minSdkVersion: 21,
      fallbackIntent: "Intent(Settings.ACTION_SOUND_SETTINGS)",
      description: "Uses standard AudioManager to adjust volume level with visual HUD indicator.",
    },
  },

  toggle_flashlight: {
    name: "toggle_flashlight",
    displayName: "Toggle Flashlight Torch",
    description: "Turns the rear camera LED flashlight on or off.",
    parameters: {
      type: "object",
      properties: {
        enabled: {
          type: "boolean",
          description: "True to turn on flashlight, false to turn it off.",
        },
      },
      required: ["enabled"],
    },
    requiredPermission: "android.permission.CAMERA",
    riskLevel: "LOW",
    requiresConfirmation: false,
    androidContract: {
      nativeApi: "cameraManager.setTorchMode(cameraId, enabled)",
      requiredPermission: "android.permission.CAMERA",
      minSdkVersion: 23,
      fallbackIntent: undefined,
      description: "Controls the rear camera torch LED directly via CameraManager.",
    },
  },

  toggle_battery_saver: {
    name: "toggle_battery_saver",
    displayName: "Toggle Battery Saver",
    description: "Opens Battery Saver settings panel or requests low power state.",
    parameters: {
      type: "object",
      properties: {
        enabled: {
          type: "boolean",
          description: "Desired battery saver state.",
        },
      },
      required: ["enabled"],
    },
    requiredPermission: "none",
    riskLevel: "LOW",
    requiresConfirmation: false,
    androidContract: {
      nativeApi: "Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS)",
      requiredPermission: "none",
      minSdkVersion: 22,
      fallbackIntent: "Intent(Settings.ACTION_POWER_USAGE_SUMMARY)",
      description: "Navigates directly to Battery Saver configuration screen.",
    },
  },

  toggle_do_not_disturb: {
    name: "toggle_do_not_disturb",
    displayName: "Toggle Do Not Disturb",
    description: "Sets device Do Not Disturb (DND) mode on or off.",
    parameters: {
      type: "object",
      properties: {
        enabled: {
          type: "boolean",
          description: "True to enable DND mode (Priority/Alarms only), false for normal interruption.",
        },
      },
      required: ["enabled"],
    },
    requiredPermission: "android.permission.ACCESS_NOTIFICATION_POLICY",
    riskLevel: "MEDIUM",
    requiresConfirmation: true,
    androidContract: {
      nativeApi: "notificationManager.setInterruptionFilter(if (enabled) INTERRUPTION_FILTER_PRIORITY else INTERRUPTION_FILTER_ALL)",
      requiredPermission: "android.permission.ACCESS_NOTIFICATION_POLICY",
      minSdkVersion: 23,
      fallbackIntent: "Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)",
      description: "Adjusts DND filter using NotificationManager. Opens policy access settings if not granted.",
    },
  },

  clear_own_cache: {
    name: "clear_own_cache",
    displayName: "Clear App Cache",
    description: "Safely clears temporary cache files generated by this application (no arbitrary file deletion).",
    parameters: {
      type: "object",
      properties: {},
    },
    requiredPermission: "none",
    riskLevel: "MEDIUM",
    requiresConfirmation: true,
    androidContract: {
      nativeApi: "context.cacheDir.deleteRecursively() && context.externalCacheDir?.deleteRecursively()",
      requiredPermission: "none",
      minSdkVersion: 21,
      fallbackIntent: undefined,
      description: "Safely purges the application's internal temporary cache directory.",
    },
  },

  get_device_info: {
    name: "get_device_info",
    displayName: "Get Device Information",
    description: "Retrieves manufacturer, device model, Android OS version, and display metrics.",
    parameters: {
      type: "object",
      properties: {},
    },
    requiredPermission: "none",
    riskLevel: "LOW",
    requiresConfirmation: false,
    androidContract: {
      nativeApi: "Build.MANUFACTURER, Build.MODEL, Build.VERSION.RELEASE, Build.VERSION.SDK_INT",
      requiredPermission: "none",
      minSdkVersion: 21,
      fallbackIntent: undefined,
      description: "Reads public Android Build properties without sensitive IMEI access.",
    },
  },

  get_battery_status: {
    name: "get_battery_status",
    displayName: "Get Battery Status",
    description: "Reads current battery percentage, charging state, and power source.",
    parameters: {
      type: "object",
      properties: {},
    },
    requiredPermission: "none",
    riskLevel: "LOW",
    requiresConfirmation: false,
    androidContract: {
      nativeApi: "batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)",
      requiredPermission: "none",
      minSdkVersion: 21,
      fallbackIntent: undefined,
      description: "Queries BatteryManager for current percentage and charging status.",
    },
  },

  get_network_status: {
    name: "get_network_status",
    displayName: "Get Network Status",
    description: "Inspects active network capabilities (Wi-Fi, Cellular, Ethernet) and internet reachability.",
    parameters: {
      type: "object",
      properties: {},
    },
    requiredPermission: "android.permission.ACCESS_NETWORK_STATE",
    riskLevel: "LOW",
    requiresConfirmation: false,
    androidContract: {
      nativeApi: "connectivityManager.getNetworkCapabilities(connectivityManager.activeNetwork)",
      requiredPermission: "android.permission.ACCESS_NETWORK_STATE",
      minSdkVersion: 23,
      fallbackIntent: undefined,
      description: "Inspects ConnectivityManager network capabilities to detect Wi-Fi or cellular connectivity.",
    },
  },
};

export interface ValidationResult {
  success: boolean;
  valid: boolean;
  tool: string;
  arguments: Record<string, any>;
  message: string;
  error?: string;
  errorCode?: string;
  requiredPermission?: string;
  requiresConfirmation: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  androidContract?: AllowlistedToolMeta["androidContract"];
}

const EXPLICITLY_PROHIBITED_PATTERNS = [
  "shell",
  "exec",
  "root",
  "su",
  "adb",
  "bash",
  "chmod",
  "rm_rf",
  "reboot",
  "wipe",
];

export function validateAction(toolName: string, args: Record<string, any>): ValidationResult {
  const normalizedTool = (toolName || "").trim().toLowerCase();

  // 1. Allowlist containment check
  const tool = ALLOWLISTED_TOOLS_REGISTRY[toolName];
  if (!tool) {
    const isProhibited =
      EXPLICITLY_PROHIBITED_PATTERNS.some((p) => normalizedTool.includes(p)) ||
      normalizedTool.split(/[\s_\-/.]+/).some((token) => token === "sh" || token === "su");

    return {
      success: false,
      valid: false,
      tool: toolName,
      arguments: args,
      error: "ACTION_NOT_ALLOWED",
      message: isProhibited
        ? "Arbitrary shell, adb, and root commands are prohibited by design."
        : `Action '${toolName}' is not permitted. Only predefined allowlisted tools can be executed.`,
      errorCode: "SECURITY_TOOL_NOT_ALLOWLISTED",
      requiresConfirmation: false,
      riskLevel: "HIGH",
    };
  }

  // 3. Specific argument range & type validations
  const sanitizedArgs: Record<string, any> = { ...args };

  if (toolName === "set_brightness") {
    const lvl = Number(sanitizedArgs.level);
    if (isNaN(lvl) || lvl < 1 || lvl > 100 || !Number.isInteger(lvl)) {
      return {
        success: false,
        valid: false,
        tool: toolName,
        arguments: args,
        error: "INVALID_ARGUMENT_RANGE",
        message: "Brightness level must be an integer between 1 and 100.",
        errorCode: "INVALID_ARGUMENT_RANGE",
        requiresConfirmation: tool.requiresConfirmation,
        riskLevel: tool.riskLevel,
      };
    }
    sanitizedArgs.level = lvl;
  }

  if (toolName === "set_volume") {
    const lvl = Number(sanitizedArgs.level);
    if (isNaN(lvl) || lvl < 0 || lvl > 100) {
      return {
        success: false,
        valid: false,
        tool: toolName,
        arguments: args,
        error: "INVALID_ARGUMENT_RANGE",
        message: "Volume level must be a number between 0 and 100.",
        errorCode: "INVALID_ARGUMENT_RANGE",
        requiresConfirmation: tool.requiresConfirmation,
        riskLevel: tool.riskLevel,
      };
    }
    sanitizedArgs.level = Math.round(lvl);
  }

  if (
    toolName === "toggle_flashlight" ||
    toolName === "toggle_battery_saver" ||
    toolName === "toggle_do_not_disturb"
  ) {
    if (typeof sanitizedArgs.enabled !== "boolean") {
      sanitizedArgs.enabled =
        sanitizedArgs.enabled === "true" ||
        sanitizedArgs.enabled === 1 ||
        !!sanitizedArgs.enabled;
    }
  }

  return {
    success: true,
    valid: true,
    tool: toolName,
    arguments: sanitizedArgs,
    message: `Action '${tool.displayName}' validated successfully.`,
    requiredPermission: tool.requiredPermission,
    requiresConfirmation: tool.requiresConfirmation,
    riskLevel: tool.riskLevel,
    androidContract: tool.androidContract,
  };
}
