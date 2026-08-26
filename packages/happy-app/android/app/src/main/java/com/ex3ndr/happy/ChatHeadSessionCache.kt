package com.ex3ndr.happy

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class ChatHeadMessage(
    val text: String,
    val outgoing: Boolean
)

data class ChatHeadSessionSnapshot(
    val sessionId: String,
    val title: String,
    val avatarUri: String,
    val messages: List<ChatHeadMessage>
)

object ChatHeadSessionCache {
    private const val PREFS_NAME = "happy_chat_head_sessions"
    private const val KEY_PREFIX = "session:"

    fun save(
        context: Context,
        sessionId: String,
        title: String?,
        avatarUri: String?,
        messagesJson: String?
    ) {
        if (sessionId.isBlank()) return

        val messages = parseMessages(messagesJson).takeLast(12)
        val payload = JSONObject().apply {
            put("sessionId", sessionId)
            put("title", title.orEmpty())
            put("avatarUri", avatarUri.orEmpty())
            put("messages", JSONArray().apply {
                messages.forEach { message ->
                    put(JSONObject().apply {
                        put("text", message.text)
                        put("outgoing", message.outgoing)
                    })
                }
            })
            put("updatedAt", System.currentTimeMillis())
        }

        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_PREFIX + sessionId, payload.toString())
            .apply()
    }

    fun load(context: Context, sessionId: String?): ChatHeadSessionSnapshot? {
        if (sessionId.isNullOrBlank()) return null
        val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_PREFIX + sessionId, null)
            ?: return null

        return runCatching {
            val payload = JSONObject(raw)
            ChatHeadSessionSnapshot(
                sessionId = payload.optString("sessionId", sessionId),
                title = payload.optString("title"),
                avatarUri = payload.optString("avatarUri"),
                messages = parseMessages(payload.optJSONArray("messages"))
            )
        }.getOrNull()
    }

    private fun parseMessages(messagesJson: String?): List<ChatHeadMessage> {
        if (messagesJson.isNullOrBlank()) return emptyList()
        return runCatching { parseMessages(JSONArray(messagesJson)) }.getOrElse { emptyList() }
    }

    private fun parseMessages(messages: JSONArray?): List<ChatHeadMessage> {
        if (messages == null) return emptyList()
        val result = mutableListOf<ChatHeadMessage>()
        for (index in 0 until messages.length()) {
            val item = messages.optJSONObject(index) ?: continue
            val text = item.optString("text").trim()
            if (text.isBlank()) continue
            result.add(
                ChatHeadMessage(
                    text = text.take(1200),
                    outgoing = item.optBoolean("outgoing", false)
                )
            )
        }
        return result
    }
}
