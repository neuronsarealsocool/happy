package com.ex3ndr.happy

import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class ChatHeadReplyService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val sessionId = intent?.getStringExtra(EXTRA_SESSION_ID)?.trim().orEmpty()
        if (sessionId.isBlank()) return null

        val data = Arguments.createMap().apply {
            putString("sessionId", sessionId)
            putBoolean("refresh", intent?.getBooleanExtra(EXTRA_REFRESH, false) == true)
        }
        return HeadlessJsTaskConfig(
            TASK_KEY,
            data,
            120_000,
            true
        )
    }

    companion object {
        private const val TASK_KEY = "HappyChatHeadReplyTask"
        private const val EXTRA_SESSION_ID = "sessionId"
        private const val EXTRA_REFRESH = "refresh"

        fun start(context: Context, sessionId: String, refresh: Boolean = false) {
            if (sessionId.isBlank()) return
            context.startService(Intent(context, ChatHeadReplyService::class.java).apply {
                putExtra(EXTRA_SESSION_ID, sessionId)
                putExtra(EXTRA_REFRESH, refresh)
            })
        }
    }
}
