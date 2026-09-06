export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AndroidApiContract {
  nativeApi: string;
  requiredPermission: string;
  minSdkVersion: number;
  fallbackIntent?: string;
  description: string;
  officialDocumentationUrl: string;
}

export interface AllowlistedToolDefinition {
  name: string;
  displayName: string;
  description: string;
  category: "display" | "connectivity" | "audio" | "hardware" | "power" | "storage" | "system";
  parameters: {
    type: string;
    properties: Record<
      string,
      {
        type: string;
        description: string;
        minimum?: number;
        maximum?: number;
        enum?: string[];
      }
    >;
    required?: string[];
  };
  requiredPermission: string;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  androidContract: AndroidApiContract;
}

export const ALLOWLISTED_TOOLS: Record<string, AllowlistedToolDefinition> = {
  set_brightness: {
    name: "set_brightness",
    displayName: "Set Screen Brightness",
    description: "Sets the screen display brightness level to an integer percentage between 1 and 100.",
    category: "display",
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
      description: "Directly sets system brightness if WRITE_SETTINGS is granted, or navigates to Display Settings.",
      officialDocumentationUrl: "https://developer.android.com/reference/android/provider/Settings.System#SCREEN_BRIGHTNESS",
    },
  },

  open_wifi_settings: {
    name: "open_wifi_settings",
    displayName: "Open Wi-Fi Settings",
    description: "Opens the official Android Wi-Fi configuration screen or Panel for safe user selection.",
    category: "connectivity",
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
      description: "Launches Android 10+ Wi-Fi Internet Panel directly inside or over the app without system-app restrictions.",
      officialDocumentationUrl: "https://developer.android.com/reference/android/provider/Settings.Panel#ACTION_WIFI",
    },
  },

  open_bluetooth_settings: {
    name: "open_bluetooth_settings",
    displayName: "Open Bluetooth Settings",
    description: "Opens the official Android Bluetooth management screen or Settings panel.",
    category: "connectivity",
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
      officialDocumentationUrl: "https://developer.android.com/reference/android/provider/Settings#ACTION_BLUETOOTH_SETTINGS",
    },
  },

  open_app_settings: {
    name: "open_app_settings",
    displayName: "Open App Settings",
    description: "Opens Application Details in Android Settings to manage permissions, storage, or notifications.",
    category: "system",
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
      description: "Safely opens the target app's System Info page allowing user to clear cache or manage permissions.",
      officialDocumentationUrl: "https://developer.android.com/reference/android/provider/Settings#ACTION_APPLICATION_DETAILS_SETTINGS",
    },
  },

  set_volume: {
    name: "set_volume",
    displayName: "Set Audio Volume",
    description: "Sets the device audio stream volume to an integer percentage between 0 and 100.",
    category: "audio",
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
      officialDocumentationUrl: "https://developer.android.com/reference/android/media/AudioManager#setStreamVolume(int,%20int,%20int)",
    },
  },

  toggle_flashlight: {
    name: "toggle_flashlight",
    displayName: "Toggle Flashlight Torch",
    description: "Turns the rear camera LED flashlight on or off.",
    category: "hardware",
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
      description: "Controls the rear camera torch LED directly via CameraManager without recording audio or capturing frames.",
      officialDocumentationUrl: "https://developer.android.com/reference/android/hardware/camera2/CameraManager#setTorchMode(java.lang.String,%20boolean)",
    },
  },

  toggle_battery_saver: {
    name: "toggle_battery_saver",
    displayName: "Toggle Battery Saver",
    description: "Opens Battery Saver settings panel or requests low power state.",
    category: "power",
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
      description: "Navigates directly to Battery Saver configuration screen where user can toggle power modes.",
      officialDocumentationUrl: "https://developer.android.com/reference/android/provider/Settings#ACTION_BATTERY_SAVER_SETTINGS",
    },
  },

  toggle_do_not_disturb: {
    name: "toggle_do_not_disturb",
    displayName: "Toggle Do Not Disturb",
    description: "Sets device Do Not Disturb (DND) mode on or off.",
    category: "audio",
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
      description: "Adjusts DND filter using NotificationManager. If permission is missing, opens policy access settings.",
      officialDocumentationUrl: "https://developer.android.com/reference/android/app/NotificationManager#setInterruptionFilter(int)",
    },
  },

  clear_own_cache: {
    name: "clear_own_cache",
    displayName: "Clear App Cache",
    description: "Safely clears temporary cache files generated by this application (no arbitrary file system deletion).",
    category: "storage",
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
      description: "Safely purges the application's internal temporary cache directory without touching user credentials or other apps.",
      officialDocumentationUrl: "https://developer.android.com/reference/android/content/Context#getCacheDir()",
    },
  },

  get_device_info: {
    name: "get_device_info",
    displayName: "Get Device Information",
    description: "Retrieves manufacturer, device model, Android OS version, and display metrics.",
    category: "system",
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
      description: "Reads public Android Build properties without sensitive IMEI or MAC address access.",
      officialDocumentationUrl: "https://developer.android.com/reference/android/os/Build",
    },
  },

  get_battery_status: {
    name: "get_battery_status",
    displayName: "Get Battery Status",
    description: "Reads current battery percentage, charging state, and power source.",
    category: "power",
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
      officialDocumentationUrl: "https://developer.android.com/reference/android/os/BatteryManager",
    },
  },

  get_network_status: {
    name: "get_network_status",
    displayName: "Get Network Status",
    description: "Inspects active network capabilities (Wi-Fi, Cellular, Ethernet) and internet reachability.",
    category: "connectivity",
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
      officialDocumentationUrl: "https://developer.android.com/reference/android/net/ConnectivityManager",
    },
  },
};
