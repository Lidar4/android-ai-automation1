package com.droidautomate.assistant

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsManager
import android.telephony.SmsMessage
import android.util.Log

/** Receives incoming SMS and sends only the explicitly configured auto-reply. */
class SmsAutoReplyReceiver : BroadcastReceiver() {
    companion object { private const val TAG = "SmsAutoReply" }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val pendingResult = goAsync()
        try {
            val messages = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                Telephony.Sms.Intents.getMessagesFromIntent(intent)
            } else {
                @Suppress("DEPRECATION")
                (intent.getSerializableExtra("pdus") as? Array<*>)?.mapNotNull { pdu ->
                    @Suppress("DEPRECATION")
                    SmsMessage.createFromPdu(pdu as ByteArray)
                }?.toTypedArray() ?: emptyArray()
            }
            if (messages.isEmpty()) return

            val sender = messages.firstNotNullOfOrNull { it.originatingAddress }.orEmpty()
            val reply = AutoReplyManager.buildReply(context, sender) ?: return

            @Suppress("DEPRECATION")
            val smsManager = context.getSystemService(SmsManager::class.java)
                ?: return
            smsManager.sendTextMessage(sender, null, reply, null, null)
            Log.i(TAG, "Configured auto-reply sent to matching sender.")
        } catch (e: Exception) {
            Log.w(TAG, "Auto-reply skipped: ${e.message}")
        } finally {
            pendingResult.finish()
        }
    }
}
