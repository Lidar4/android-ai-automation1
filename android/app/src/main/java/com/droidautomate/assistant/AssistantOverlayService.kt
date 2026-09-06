package com.droidautomate.assistant

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.TextView

/** Lightweight, user-enabled floating assistant entry point. */
class AssistantOverlayService : Service() {
    private var windowManager: WindowManager? = null
    private var bubble: TextView? = null

    override fun onCreate() {
        super.onCreate()
        if (!Settings.canDrawOverlays(this)) { stopSelf(); return }
        startForeground(42, buildNotification())
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        bubble = TextView(this).apply {
            text = "✦"
            textSize = 22f
            setTextColor(Color.WHITE)
            setBackgroundColor(0xFF2563EB.toInt())
            gravity = Gravity.CENTER
            setOnClickListener { openAssistant() }
        }
        val type = if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE
        val params = WindowManager.LayoutParams(60, 60, type, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT).apply {
            gravity = Gravity.TOP or Gravity.END
            x = 20; y = 220
        }
        try { windowManager?.addView(bubble, params) } catch (_: Exception) { stopSelf() }
    }

    private fun openAssistant() {
        val intent = Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        startActivity(intent)
    }

    private fun buildNotification(): Notification {
        val channelId = "assistant_overlay"
        if (Build.VERSION.SDK_INT >= 26) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(channelId, "Assistant overlay", NotificationManager.IMPORTANCE_LOW))
        }
        return if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, channelId)
            .setContentTitle("Android AI Assistant")
            .setContentText("Floating assistant is active")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .build()
        else Notification.Builder(this).setContentTitle("Android AI Assistant").setSmallIcon(android.R.drawable.ic_dialog_info).build()
    }

    override fun onDestroy() {
        bubble?.let { try { windowManager?.removeView(it) } catch (_: Exception) {} }
        bubble = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
