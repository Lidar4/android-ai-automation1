package com.droidautomate.assistant

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import org.json.JSONArray
import org.json.JSONObject

/**
 * Secure, privacy-preserving Android device information provider.
 * Does NOT collect IMEI, MAC addresses, or persistent advertising IDs.
 */
object DeviceInfoProvider {

    fun getDeviceInfo(context: Context): JSONObject {
        val root = JSONObject()

        // Hardware & OS Specs
        root.put("manufacturer", Build.MANUFACTURER)
        root.put("model", Build.MODEL)
        root.put("device", Build.DEVICE)
        root.put("androidVersion", Build.VERSION.RELEASE)
        root.put("sdkInt", Build.VERSION.SDK_INT)
        root.put("buildId", Build.ID)
        root.put("securityPatch", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Build.VERSION.SECURITY_PATCH else "N/A")

        // Battery Status
        root.put("battery", getBatteryStatus(context))

        // Network Status
        root.put("network", getNetworkStatus(context))

        // Storage metrics
        root.put("storage", getStorageMetrics(context))

        // Allowlisted tools
        val toolsArray = JSONArray()
        val tools = listOf(
            "set_brightness",
            "open_wifi_settings",
            "open_bluetooth_settings",
            "open_app_settings",
            "set_volume",
            "toggle_flashlight",
            "toggle_battery_saver",
            "toggle_do_not_disturb",
            "clear_own_cache",
            "get_device_info",
            "get_battery_status",
            "get_network_status"
        )
        tools.forEach { toolsArray.put(it) }
        root.put("supportedTools", toolsArray)

        return root
    }

    fun getBatteryStatus(context: Context): JSONObject {
        val obj = JSONObject()
        val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        val batteryStatus: Intent? = context.registerReceiver(null, filter)

        val level: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val status: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val isCharging: Boolean = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL

        val batteryPct: Float = if (level >= 0 && scale > 0) (level * 100 / scale.toFloat()) else 0f

        obj.put("level", batteryPct.toInt())
        obj.put("isCharging", isCharging)
        obj.put("status", when (status) {
            BatteryManager.BATTERY_STATUS_CHARGING -> "CHARGING"
            BatteryManager.BATTERY_STATUS_FULL -> "FULL"
            BatteryManager.BATTERY_STATUS_DISCHARGING -> "DISCHARGING"
            BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "NOT_CHARGING"
            else -> "UNKNOWN"
        })

        return obj
    }

    fun getNetworkStatus(context: Context): JSONObject {
        val obj = JSONObject()
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager

        if (cm == null) {
            obj.put("connected", false)
            obj.put("type", "UNKNOWN")
            return obj
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val activeNetwork = cm.activeNetwork
            val capabilities = cm.getNetworkCapabilities(activeNetwork)

            if (capabilities == null) {
                obj.put("connected", false)
                obj.put("type", "NONE")
                return obj
            }

            val isWifi = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
            val isCellular = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
            val isEthernet = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)

            obj.put("connected", capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET))
            obj.put("type", when {
                isWifi -> "WIFI"
                isCellular -> "CELLULAR"
                isEthernet -> "ETHERNET"
                else -> "OTHER"
            })
            obj.put("metered", !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED))
        } else {
            @Suppress("DEPRECATION")
            val networkInfo = cm.activeNetworkInfo
            val isConnected = networkInfo?.isConnectedOrConnecting == true
            obj.put("connected", isConnected)
            @Suppress("DEPRECATION")
            obj.put("type", networkInfo?.typeName ?: "NONE")
        }

        return obj
    }

    private fun getStorageMetrics(context: Context): JSONObject {
        val obj = JSONObject()
        try {
            val path = Environment.getDataDirectory()
            val stat = StatFs(path.path)
            val blockSize = stat.blockSizeLong
            val totalBlocks = stat.blockCountLong
            val availableBlocks = stat.availableBlocksLong

            val totalBytes = totalBlocks * blockSize
            val freeBytes = availableBlocks * blockSize
            val usedBytes = totalBytes - freeBytes

            obj.put("totalGb", String.format("%.2f", totalBytes / (1024.0 * 1024.0 * 1024.0)))
            obj.put("freeGb", String.format("%.2f", freeBytes / (1024.0 * 1024.0 * 1024.0)))
            obj.put("usedGb", String.format("%.2f", usedBytes / (1024.0 * 1024.0 * 1024.0)))
        } catch (e: Exception) {
            obj.put("error", "Storage query unavailable")
        }
        return obj
    }
}
