package com.ex3ndr.happy

import android.app.Notification
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

class HappyNotificationListenerService : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName != packageName) {
            return
        }
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            sbn.notification.channelId == ChatHeadOverlayService.FOREGROUND_CHANNEL_ID
        ) {
            return
        }

        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
        val body = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
        val sessionId = extractSessionId(extras)

        ChatHeadOverlayService.start(
            applicationContext,
            title,
            body,
            sessionId,
            null,
            sbn.notification.number
        )
    }

    private fun extractSessionId(extras: android.os.Bundle): String? {
        directSessionId(extras)?.let { return it }

        for (key in listOf("data", "payload", "params", "body")) {
            val raw = extras.getString(key)?.takeIf { it.isNotBlank() } ?: continue
            sessionIdFromJson(raw)?.let { return it }
            sessionIdFromUrl(raw)?.let { return it }
        }

        for (key in listOf("url", "link", "deepLink")) {
            extras.getString(key)?.let { raw ->
                sessionIdFromUrl(raw)?.let { return it }
            }
        }

        return null
    }

    private fun directSessionId(extras: android.os.Bundle): String? {
        return listOf("sessionId", "session_id", "conversationId", "conversation_id", "sid")
            .firstNotNullOfOrNull { key -> extras.getString(key)?.takeIf { it.isNotBlank() } }
    }

    private fun sessionIdFromJson(raw: String): String? {
        return runCatching {
            val json = JSONObject(raw)
            listOf("sessionId", "session_id", "conversationId", "conversation_id", "sid")
                .firstNotNullOfOrNull { key -> json.optString(key).takeIf { it.isNotBlank() } }
                ?: json.optString("url").takeIf { it.isNotBlank() }?.let { sessionIdFromUrl(it) }
        }.getOrNull()
    }

    private fun sessionIdFromUrl(raw: String): String? {
        val match = Regex("""(?:^|/)session/([^/?#]+)""").find(raw.trim()) ?: return null
        return java.net.URLDecoder.decode(match.groupValues[1], Charsets.UTF_8.name())
            .takeIf { it.isNotBlank() }
    }
}
