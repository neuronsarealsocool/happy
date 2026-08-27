package com.ex3ndr.happy

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ChatHeadModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "HappyChatHeads"

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        promise.resolve(ChatHeadOverlayService.canDrawOverlays(reactContext))
    }

    @ReactMethod
    fun openOverlaySettings() {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${reactContext.packageName}")
            )
        } else {
            Intent(Settings.ACTION_SETTINGS)
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun canReadNotifications(promise: Promise) {
        val enabledListeners = Settings.Secure.getString(
            reactContext.contentResolver,
            "enabled_notification_listeners"
        )
        val componentName = "${reactContext.packageName}/${HappyNotificationListenerService::class.java.name}"
        promise.resolve(!enabledListeners.isNullOrBlank() && enabledListeners.split(':').any {
            TextUtils.equals(it, componentName)
        })
    }

    @ReactMethod
    fun openNotificationListenerSettings() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun showTestChatHead(title: String?, body: String?, sessionId: String?, avatarUri: String?) {
        ChatHeadOverlayService.start(reactContext, title, body, sessionId, avatarUri)
    }

    @ReactMethod
    fun cacheSession(sessionId: String, title: String?, avatarUri: String?, messagesJson: String?) {
        ChatHeadSessionCache.save(reactContext, sessionId, title, avatarUri, messagesJson)
        ChatHeadOverlayService.refresh(reactContext, sessionId)
    }

    @ReactMethod
    fun consumePendingReplies(sessionId: String, promise: Promise) {
        promise.resolve(ChatHeadSessionCache.consumePendingReplies(reactContext, sessionId))
    }

    @ReactMethod
    fun getActiveSessionId(promise: Promise) {
        promise.resolve(ChatHeadOverlayService.activeSessionId())
    }

    @ReactMethod
    fun addListener(eventName: String) = Unit

    @ReactMethod
    fun removeListeners(count: Int) = Unit

    companion object {
        const val EVENT_OPENED = "HappyChatHeadOpened"
        const val EVENT_REPLY_QUEUED = "HappyChatHeadReplyQueued"

        fun emit(context: android.content.Context, eventName: String, sessionId: String): Boolean {
            val reactApplication = context.applicationContext as? ReactApplication ?: return false
            val reactContext = reactApplication.reactHost?.currentReactContext ?: return false
            val payload = Arguments.createMap().apply { putString("sessionId", sessionId) }
            reactContext.emitDeviceEvent(eventName, payload)
            return true
        }
    }
}
