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

class DeviceActionExecutor(private val context: Context) {
    fun execute(tool: String, args: JSONObject): JSONObject = when (tool) {
        "set_brightness" -> executeSetBrightness(args)
        "open_wifi_settings" -> executeOpenWifiSettings()
        "open_bluetooth_settings" -> executeOpenBluetoothSettings()
        "open_app_settings" -> executeOpenAppSettings()
        "set_volume" -> executeSetVolume(args)
        "toggle_flashlight" -> executeToggleFlashlight(args)
        "toggle_battery_saver" -> executeToggleBatterySaver()
        "toggle_do_not_disturb" -> executeToggleDoNotDisturb(args)
        "clear_own_cache" -> executeClearOwnCache()
        "get_device_info" -> makeSuccessResult("get_device_info", "Retrieved hardware and OS telemetry.", DeviceInfoProvider.getDeviceInfo(context))
        "get_battery_status" -> makeSuccessResult("get_battery_status", "Battery status retrieved.", DeviceInfoProvider.getBatteryStatus(context))
        "get_network_status" -> makeSuccessResult("get_network_status", "Network connectivity telemetry retrieved.", DeviceInfoProvider.getNetworkStatus(context))
        else -> makeErrorResult(tool, "ACTION_NOT_ALLOWED", "Action '$tool' is not implemented in DeviceActionExecutor.")
    }

    private fun executeSetBrightness(args: JSONObject): JSONObject {
        val level = args.optInt("level", 50)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.System.canWrite(context)) {
            context.startActivity(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
            return makeErrorResult("set_brightness", "PERMISSION_REQUIRED", "Modifying system brightness requires WRITE_SETTINGS permission. Opened authorization screen.")
        }
        return try {
            val brightnessValue = (level * 255) / 100
            Settings.System.putInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL)
            Settings.System.putInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS, brightnessValue)
            makeSuccessResult("set_brightness", "Screen brightness set to $level%", JSONObject().apply {
                put("level", level); put("rawBrightness", brightnessValue)
            })
        } catch (e: Exception) {
            makeErrorResult("set_brightness", "ANDROID_RESTRICTION", "Failed to adjust brightness: ${e.message}")
        }
    }

    private fun executeOpenWifiSettings() = openSettings("open_wifi_settings", Settings.ACTION_WIFI_SETTINGS, "Opened Android Wi-Fi settings.")
    private fun executeOpenBluetoothSettings() = openSettings("open_bluetooth_settings", Settings.ACTION_BLUETOOTH_SETTINGS, "Opened Android Bluetooth settings.")
    private fun executeOpenAppSettings(): JSONObject = try {
        context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", context.packageName, null); addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
        makeSuccessResult("open_app_settings", "Opened application info screen.")
    } catch (e: Exception) { makeErrorResult("open_app_settings", "ANDROID_RESTRICTION", "Could not open app settings: ${e.message}") }

    private fun openSettings(tool: String, action: String, message: String): JSONObject = try {
        context.startActivity(Intent(action).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
        makeSuccessResult(tool, message)
    } catch (e: Exception) { makeErrorResult(tool, "ANDROID_RESTRICTION", "Could not open Android settings: ${e.message}") }

    private fun executeSetVolume(args: JSONObject): JSONObject {
        val level = args.optInt("level", 50)
        val streamType = args.optString("stream_type", "MEDIA").uppercase()
        val stream = when (streamType) {
            "MEDIA" -> AudioManager.STREAM_MUSIC
            "RING" -> AudioManager.STREAM_RING
            "ALARM" -> AudioManager.STREAM_ALARM
            "NOTIFICATION" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) AudioManager.STREAM_NOTIFICATION else AudioManager.STREAM_RING
            "SYSTEM" -> AudioManager.STREAM_SYSTEM
            "VOICE_CALL" -> AudioManager.STREAM_VOICE_CALL
            else -> return makeErrorResult("set_volume", "INVALID_ARGUMENTS", "Unsupported stream_type: $streamType")
        }
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            ?: return makeErrorResult("set_volume", "UNSUPPORTED_DEVICE", "AudioManager is unavailable.")
        return try {
            val maxVolume = audioManager.getStreamMaxVolume(stream)
            val targetVolume = (level * maxVolume) / 100
            audioManager.setStreamVolume(stream, targetVolume, AudioManager.FLAG_SHOW_UI)
            makeSuccessResult("set_volume", "${streamType.lowercase()} volume adjusted to $level%", JSONObject().apply {
                put("level", level); put("volumeIndex", targetVolume); put("maxVolume", maxVolume); put("stream_type", streamType)
            })
        } catch (e: Exception) { makeErrorResult("set_volume", "ANDROID_RESTRICTION", "Could not set volume: ${e.message}") }
    }

    private fun executeToggleFlashlight(args: JSONObject): JSONObject {
        val enabled = args.optBoolean("enabled", true)
        val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
            ?: return makeErrorResult("toggle_flashlight", "UNSUPPORTED_DEVICE", "CameraManager service unavailable.")
        if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
            return makeErrorResult("toggle_flashlight", "PERMISSION_REQUIRED", "Camera permission is required to control flashlight torch.")
        return try {
            val selectedCameraId = cameraManager.cameraIdList.firstOrNull { id ->
                cameraManager.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            } ?: return makeErrorResult("toggle_flashlight", "UNSUPPORTED_DEVICE", "No camera flash hardware detected on this device.")
            cameraManager.setTorchMode(selectedCameraId, enabled)
            makeSuccessResult("toggle_flashlight", "Torch flashlight turned ${if (enabled) "ON" else "OFF"}.", JSONObject().apply {
                put("torchOn", enabled); put("cameraId", selectedCameraId)
            })
        } catch (e: CameraAccessException) { makeErrorResult("toggle_flashlight", "ANDROID_RESTRICTION", "Camera hardware busy or unavailable: ${e.message}")
        } catch (e: Exception) { makeErrorResult("toggle_flashlight", "ANDROID_RESTRICTION", "Could not toggle flashlight: ${e.message}") }
    }

    private fun executeToggleBatterySaver(): JSONObject = try {
        context.startActivity(Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
        makeSuccessResult("toggle_battery_saver", "Opened Android Battery Saver settings screen. No direct toggle was claimed.")
    } catch (e: Exception) { makeErrorResult("toggle_battery_saver", "ANDROID_RESTRICTION", "Could not open Battery Saver settings: ${e.message}") }

    private fun executeToggleDoNotDisturb(args: JSONObject): JSONObject {
        val enabled = args.optBoolean("enabled", true)
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            ?: return makeErrorResult("toggle_do_not_disturb", "UNSUPPORTED_DEVICE", "NotificationManager is unavailable.")
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return makeErrorResult("toggle_do_not_disturb", "ANDROID_RESTRICTION", "Do Not Disturb API requires Android 6.0 or higher.")
        if (!manager.isNotificationPolicyAccessGranted) {
            context.startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
            return makeErrorResult("toggle_do_not_disturb", "PERMISSION_REQUIRED", "Do Not Disturb requires Notification Policy Access. Opened system access screen.")
        }
        return try {
            manager.setInterruptionFilter(if (enabled) NotificationManager.INTERRUPTION_FILTER_PRIORITY else NotificationManager.INTERRUPTION_FILTER_ALL)
            makeSuccessResult("toggle_do_not_disturb", "Do Not Disturb filter set to ${if (enabled) "ACTIVE" else "OFF"}.", JSONObject().apply { put("dndEnabled", enabled) })
        } catch (e: Exception) { makeErrorResult("toggle_do_not_disturb", "ANDROID_RESTRICTION", "Failed to toggle DND: ${e.message}") }
    }

    private fun executeClearOwnCache(): JSONObject = try {
        val cacheDir = context.cacheDir
        var bytesFreed = 0L
        fun deleteChildren(file: File) {
            file.listFiles()?.forEach { child ->
                if (child.isDirectory) deleteChildren(child)
                bytesFreed += child.length()
                child.delete()
            }
        }
        deleteChildren(cacheDir)
        makeSuccessResult("clear_own_cache", "Application internal cache cleared.", JSONObject().apply {
            put("bytesFreed", bytesFreed); put("formatted", String.format("%.2f KB", bytesFreed / 1024.0))
        })
    } catch (e: Exception) { makeErrorResult("clear_own_cache", "ANDROID_RESTRICTION", "Could not clear cache: ${e.message}") }

    private fun makeSuccessResult(tool: String, message: String, data: JSONObject = JSONObject()) = JSONObject().apply {
        put("success", true); put("tool", tool); put("message", message); put("source", "android_native")
        put("timestamp", System.currentTimeMillis()); put("data", data); put("result", data)
    }

    private fun makeErrorResult(tool: String, code: String, message: String) = JSONObject().apply {
        put("success", false); put("tool", tool); put("error", JSONObject().apply { put("code", code); put("message", message) })
        put("errorCode", code); put("message", message); put("source", "android_native"); put("timestamp", System.currentTimeMillis())
    }
}
