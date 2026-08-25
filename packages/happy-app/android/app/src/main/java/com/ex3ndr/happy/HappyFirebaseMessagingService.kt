package com.ex3ndr.happy

import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

class HappyFirebaseMessagingService : ExpoFirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val notification = message.notification
        val data = message.data
        val title = notification?.title
            ?: data["title"]
            ?: data["sessionTitle"]
            ?: data["conversationTitle"]
            ?: "Happy"
        val body = notification?.body
            ?: data["body"]
            ?: data["message"]
            ?: data["text"]
            ?: "New message"
        val sessionId = data["sessionId"] ?: data["session_id"] ?: data["conversationId"]
        val avatarUri = data["avatarUri"] ?: data["avatarUrl"] ?: data["profilePicture"]

        ChatHeadOverlayService.start(applicationContext, title, body, sessionId, avatarUri)
    }
}
