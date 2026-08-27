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
    private const val PENDING_REPLY_PREFIX = "pending-replies:"

    fun save(
        context: Context,
        sessionId: String,
        title: String?,
        avatarUri: String?,
        messagesJson: String?
    ) {
        if (sessionId.isBlank()) return

        val existing = load(context, sessionId)
        val messages = if (messagesJson == null) {
            existing?.messages.orEmpty()
        } else {
            parseMessages(messagesJson)
        }
        val payload = JSONObject().apply {
            put("sessionId", sessionId)
            put("title", title?.takeIf { it.isNotBlank() } ?: existing?.title.orEmpty())
            put("avatarUri", avatarUri?.takeIf { it.isNotBlank() } ?: existing?.avatarUri.orEmpty())
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

        return parseSnapshot(raw, sessionId)
    }

    fun findByNotification(context: Context, title: String?, body: String?): ChatHeadSessionSnapshot? {
        val needles = listOfNotNull(title, body)
            .map(::normalize)
            .filter { it.isNotBlank() }
        if (needles.isEmpty()) return null

        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .all
            .asSequence()
            .filter { (key, value) -> key.startsWith(KEY_PREFIX) && value is String }
            .mapNotNull { (_, value) -> parseSnapshot(value as String, null) }
            .map { snapshot -> snapshot to scoreSnapshot(snapshot, needles) }
            .filter { (_, score) -> score > 0 }
            .maxByOrNull { (_, score) -> score }
            ?.first
    }

    fun enqueuePendingReply(context: Context, sessionId: String, text: String, nonce: String) {
        val trimmed = text.trim()
        if (sessionId.isBlank() || trimmed.isBlank()) return

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val key = PENDING_REPLY_PREFIX + sessionId
        val pending = runCatching { JSONArray(prefs.getString(key, "[]")) }.getOrElse { JSONArray() }
        pending.put(JSONObject().apply {
            put("id", nonce)
            put("text", trimmed)
            put("createdAt", System.currentTimeMillis())
        })
        prefs.edit().putString(key, pending.toString()).apply()
    }

    fun consumePendingReplies(context: Context, sessionId: String): String {
        if (sessionId.isBlank()) return "[]"
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val key = PENDING_REPLY_PREFIX + sessionId
        val raw = prefs.getString(key, "[]") ?: "[]"
        prefs.edit().remove(key).apply()
        return raw
    }

    fun hasPendingReplies(context: Context, sessionId: String): Boolean {
        if (sessionId.isBlank()) return false
        val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(PENDING_REPLY_PREFIX + sessionId, null)
            ?: return false
        return runCatching { JSONArray(raw).length() > 0 }.getOrDefault(false)
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

    private fun parseSnapshot(raw: String, fallbackSessionId: String?): ChatHeadSessionSnapshot? {
        return runCatching {
            val payload = JSONObject(raw)
            ChatHeadSessionSnapshot(
                sessionId = payload.optString("sessionId", fallbackSessionId.orEmpty()),
                title = payload.optString("title"),
                avatarUri = payload.optString("avatarUri"),
                messages = parseMessages(payload.optJSONArray("messages"))
            )
        }.getOrNull()
    }

    private fun scoreSnapshot(snapshot: ChatHeadSessionSnapshot, needles: List<String>): Int {
        val normalizedTitle = normalize(snapshot.title)
        val titleScore = needles.maxOf { needle ->
            when {
                normalizedTitle == needle -> 100
                normalizedTitle.contains(needle) || needle.contains(normalizedTitle) -> 60
                else -> 0
            }
        }
        val messageScore = snapshot.messages.maxOfOrNull { message ->
            val normalizedMessage = normalize(message.text)
            needles.maxOf { needle ->
                when {
                    normalizedMessage == needle -> 30
                    normalizedMessage.contains(needle) || needle.contains(normalizedMessage) -> 10
                    else -> 0
                }
            }
        } ?: 0
        return titleScore + messageScore
    }

    private fun normalize(value: String): String {
        return value.lowercase().trim().replace(Regex("""\s+"""), " ")
    }
}
