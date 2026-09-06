package com.droidautomate.assistant

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.File

/**
 * DeviceActionExecutor
 * The ONLY component authorized to touch native Android hardware and system services.
 * Every action must have already passed ActionValidator.
 */
class DeviceActionExecutor(private val context: Context) {

    fun execute(tool: String, args: JSONObject): JSONObject {
        return when (tool) {
            "set_brightness" -> executeSetBrightness(args)
            "open_wifi_settings" -> executeOpenWifiSettings()
            "open_bluetooth_settings" -> executeOpenBluetoothSettings()
            "open_app_settings" -> executeOpenAppSettings()
            "set_volume" -> executeSetVolume(args)
            "toggle_flashlight" -> executeToggleFlashlight(args)
            "toggle_battery_saver" -> executeToggleBatterySaver(args)
            "toggle_do_not_disturb" -> executeToggleDoNotDisturb(args)
            "clear_own_cache" -> executeClearOwnCache()
            "get_device_info" -> executeGetDeviceInfo()
            "get_battery_status" -> executeGetBatteryStatus()
            "get_network_status" -> executeGetNetworkStatus()
            else -> makeErrorResult(
                tool = tool,
                code = "ACTION_NOT_ALLOWED",
                message = "Action '$tool' is not implemented in DeviceActionExecutor."
            )
        }
    }

    private fun executeSetBrightness(args: JSONObject): JSONObject {
        val level = args.optInt("level", 50)

        // Check if write settings permission is granted
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.System.canWrite(context)) {
                // Cannot fake success! Must inform user and open settings grant screen.
                val intent = Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS).apply {
                    data = Uri.parse("package:" + context.packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)

                return makeErrorResult(
                    tool = "set_brightness",
                    code = "PERMISSION_REQUIRED",
                    message = "Modifying system brightness requires WRITE_SETTINGS permission. Opened authorization screen."
                )
            }
        }

        return try {
            val brightnessValue = (level * 255) / 100
            Settings.System.putInt(
                context.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS_MODE,
                Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL
            )
            Settings.System.putInt(
                context.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS,
                brightnessValue
            )

            val resultData = JSONObject().apply {
                put("level", level)
                put("rawBrightness", brightnessValue)
            }
            makeSuccessResult("set_brightness", "Screen brightness set to $level%", resultData)
        } catch (e: Exception) {
            makeErrorResult(
                tool = "set_brightness",
                code = "ANDROID_RESTRICTION",
                message = "Failed to adjust brightness: ${e.message}"
            )
        }
    }

    private fun executeOpenWifiSettings(): JSONObject {
        return try {
            val intent = Intent(Settings.ACTION_WIFI_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            makeSuccessResult("open_wifi_settings", "Opened Android Wi-Fi settings.")
        } catch (e: Exception) {
            makeErrorResult("open_wifi_settings", "ANDROID_RESTRICTION", "Could not open Wi-Fi settings: ${e.message}")
        }
    }

    private fun executeOpenBluetoothSettings(): JSONObject {
        return try {
            val intent = Intent(Settings.ACTION_BLUETOOTH_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            makeSuccessResult("open_bluetooth_settings", "Opened Android Bluetooth settings.")
        } catch (e: Exception) {
            makeErrorResult("open_bluetooth_settings", "ANDROID_RESTRICTION", "Could not open Bluetooth settings: ${e.message}")
        }
    }

    private fun executeOpenAppSettings(): JSONObject {
        return try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", context.packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            makeSuccessResult("open_app_settings", "Opened application info screen.")
        } catch (e: Exception) {
            makeErrorResult("open_app_settings", "ANDROID_RESTRICTION", "Could not open app settings: ${e.message}")
        }
    }

    private fun executeSetVolume(args: JSONObject): JSONObject {
        val level = args.optInt("level", 50)
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            ?: return makeErrorResult("set_volume", "UNSUPPORTED_DEVICE", "AudioManager is unavailable.")

        return try {
            val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val targetVolume = (level * maxVolume) / 100
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, targetVolume, AudioManager.FLAG_SHOW_UI)

            val resultData = JSONObject().apply {
                put("level", level)
                put("volumeIndex", targetVolume)
                put("maxVolume", maxVolume)
            }
            makeSuccessResult("set_volume", "Media volume adjusted to $level%", resultData)
        } catch (e: Exception) {
            makeErrorResult("set_volume", "ANDROID_RESTRICTION", "Could not set volume: ${e.message}")
        }
    }

    private fun executeToggleFlashlight(args: JSONObject): JSONObject {
        val enabled = args.optBoolean("enabled", true)
        val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
            ?: return makeErrorResult("toggle_flashlight", "UNSUPPORTED_DEVICE", "CameraManager service unavailable.")

        if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            return makeErrorResult(
                tool = "toggle_flashlight",
                code = "PERMISSION_REQUIRED",
                message = "Camera permission is required to control flashlight torch."
            )
        }

        return try {
            var selectedCameraId: String? = null
            for (id in cameraManager.cameraIdList) {
                val characteristics = cameraManager.getCameraCharacteristics(id)
                val hasFlash = characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) ?: false
                if (hasFlash) {
                    selectedCameraId = id
                    break
                }
            }

            if (selectedCameraId == null) {
                return makeErrorResult("toggle_flashlight", "UNSUPPORTED_DEVICE", "No camera flash hardware detected on this device.")
            }

            cameraManager.setTorchMode(selectedCameraId, enabled)
            val data = JSONObject().apply {
                put("torchOn", enabled)
                put("cameraId", selectedCameraId)
            }
            makeSuccessResult("toggle_flashlight", "Torch flashlight turned ${if (enabled) "ON" else "OFF"}.", data)
        } catch (e: CameraAccessException) {
            makeErrorResult("toggle_flashlight", "ANDROID_RESTRICTION", "Camera hardware busy or unavailable: ${e.message}")
        } catch (e: Exception) {
            makeErrorResult("toggle_flashlight", "ANDROID_RESTRICTION", "Could not toggle flashlight: ${e.message}")
        }
    }

    private fun executeToggleBatterySaver(args: JSONObject): JSONObject {
        // Direct toggling of battery saver without user interaction requires privileged system permission
        // android.permission.WRITE_SECURE_SETTINGS which standard apps cannot hold without root.
        // We gracefully open the Battery Saver Settings screen rather than faking success.
        return try {
            val intent = Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            makeSuccessResult("toggle_battery_saver", "Navigated to Android Battery Saver settings screen.")
        } catch (e: Exception) {
            makeErrorResult("toggle_battery_saver", "ANDROID_RESTRICTION", "Could not open Battery Saver settings: ${e.message}")
        }
    }

    private fun executeToggleDoNotDisturb(args: JSONObject): JSONObject {
        val enabled = args.optBoolean("enabled", true)
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            ?: return makeErrorResult("toggle_do_not_disturb", "UNSUPPORTED_DEVICE", "NotificationManager is unavailable.")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!notificationManager.isNotificationPolicyAccessGranted) {
                val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                return makeErrorResult(
                    tool = "toggle_do_not_disturb",
                    code = "PERMISSION_REQUIRED",
                    message = "Do Not Disturb requires Notification Policy Access. Opened system access screen."
                )
            }

            return try {
                val filter = if (enabled) {
                    NotificationManager.INTERRUPTION_FILTER_PRIORITY
                } else {
                    NotificationManager.INTERRUPTION_FILTER_ALL
                }
                notificationManager.setInterruptionFilter(filter)

                val data = JSONObject().apply { put("dndEnabled", enabled) }
                makeSuccessResult("toggle_do_not_disturb", "Do Not Disturb filter set to ${if (enabled) "ACTIVE" else "OFF"}.", data)
            } catch (e: Exception) {
                makeErrorResult("toggle_do_not_disturb", "ANDROID_RESTRICTION", "Failed to toggle DND: ${e.message}")
            }
        } else {
            return makeErrorResult("toggle_do_not_disturb", "ANDROID_RESTRICTION", "Do Not Disturb API requires Android 6.0 (API 23) or higher.")
        }
    }

    private fun executeClearOwnCache(): JSONObject {
        return try {
            val cacheDir = context.cacheDir
            var bytesFreed: Long = 0

            fun deleteRecursively(file: File) {
                if (file.isDirectory) {
                    file.listFiles()?.forEach { deleteRecursively(it) }
                }
                bytesFreed += file.length()
                file.delete()
            }

            deleteRecursively(cacheDir)

            val data = JSONObject().apply {
                put("bytesFreed", bytesFreed)
                put("formatted", String.format("%.2f KB", bytesFreed / 1024.0))
            }
            makeSuccessResult("clear_own_cache", "Application internal cache cleared (${data.getString("formatted")}).", data)
        } catch (e: Exception) {
            makeErrorResult("clear_own_cache", "ANDROID_RESTRICTION", "Could not clear cache: ${e.message}")
        }
    }

    private fun executeGetDeviceInfo(): JSONObject {
        val info = DeviceInfoProvider.getDeviceInfo(context)
        return makeSuccessResult("get_device_info", "Retrieved hardware and OS telemetry.", info)
    }

    private fun executeGetBatteryStatus(): JSONObject {
        val battery = DeviceInfoProvider.getBatteryStatus(context)
        return makeSuccessResult("get_battery_status", "Battery status retrieved.", battery)
    }

    private fun executeGetNetworkStatus(): JSONObject {
        val network = DeviceInfoProvider.getNetworkStatus(context)
        return makeSuccessResult("get_network_status", "Network connectivity telemetry retrieved.", network)
    }

    private fun makeSuccessResult(tool: String, message: String, data: JSONObject = JSONObject()): JSONObject {
        return JSONObject().apply {
            put("success", true)
            put("tool", tool)
            put("message", message)
            put("source", "android_native")
            put("timestamp", System.currentTimeMillis())
            put("data", data)
            put("result", data) // for protocol compatibility
        }
    }

    private fun makeErrorResult(tool: String, code: String, message: String): JSONObject {
        val errorObj = JSONObject().apply {
            put("code", code)
            put("message", message)
        }
        return JSONObject().apply {
            put("success", false)
            put("tool", tool)
            put("error", errorObj)
            put("errorCode", code)
            put("message", message)
            put("source", "android_native")
            put("timestamp", System.currentTimeMillis())
        }
    }
}
