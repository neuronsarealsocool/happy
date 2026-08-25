package com.ex3ndr.happy

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class HappyNotificationListenerService : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName != packageName) {
            return
        }

        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
        val body = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
        val sessionId = listOf("sessionId", "session_id", "conversationId", "conversation_id", "sid")
            .firstNotNullOfOrNull { key -> extras.getString(key)?.takeIf { it.isNotBlank() } }

        ChatHeadOverlayService.start(
            applicationContext,
            title,
            body,
            sessionId,
            null
        )
    }
}
