package com.ex3ndr.happy

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class ChatHeadMessage(
    val text: String,
    val outgoing: Boolean,
    val attachment: Boolean = false
)

data class ChatHeadSessionSnapshot(
    val sessionId: String,
    val title: String,
    val avatarUri: String,
    val messages: List<ChatHeadMessage>,
    val isWorking: Boolean,
    val updatedAt: Long
)

data class ChatHeadPendingAttachment(
    val id: String,
    val uri: String,
    val name: String,
    val mimeType: String,
    val size: Long,
    val createdAt: Long
)

object ChatHeadSessionCache {
    private const val PREFS_NAME = "happy_chat_head_sessions"
    private const val KEY_PREFIX = "session:"
    private const val PENDING_REPLY_PREFIX = "pending-replies:"
    private const val PENDING_ATTACHMENT_PREFIX = "pending-attachments:"

    fun save(
        context: Context,
        sessionId: String,
        title: String?,
        avatarUri: String?,
        messagesJson: String?,
        isWorking: Boolean? = null
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
            put("isWorking", isWorking ?: existing?.isWorking ?: false)
            put("messages", JSONArray().apply {
                messages.forEach { message ->
                    put(JSONObject().apply {
                        put("text", message.text)
                        put("outgoing", message.outgoing)
                        put("attachment", message.attachment)
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

    fun mostRecent(context: Context): ChatHeadSessionSnapshot? {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .all
            .asSequence()
            .filter { (key, value) -> key.startsWith(KEY_PREFIX) && value is String }
            .mapNotNull { (_, value) -> parseSnapshot(value as String, null) }
            .maxByOrNull { it.updatedAt }
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

    fun pendingReplies(context: Context, sessionId: String): String {
        if (sessionId.isBlank()) return "[]"
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val key = PENDING_REPLY_PREFIX + sessionId
        return prefs.getString(key, "[]") ?: "[]"
    }

    fun acknowledgePendingReply(context: Context, sessionId: String, replyId: String) {
        if (sessionId.isBlank() || replyId.isBlank()) return
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val key = PENDING_REPLY_PREFIX + sessionId
        val pending = runCatching { JSONArray(prefs.getString(key, "[]")) }.getOrElse { JSONArray() }
        val remaining = JSONArray()
        for (index in 0 until pending.length()) {
            val item = pending.optJSONObject(index) ?: continue
            if (item.optString("id") != replyId) {
                remaining.put(item)
            }
        }
        prefs.edit().putString(key, remaining.toString()).apply()
    }

    fun hasPendingReplies(context: Context, sessionId: String): Boolean {
        if (sessionId.isBlank()) return false
        val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(PENDING_REPLY_PREFIX + sessionId, null)
            ?: return false
        return runCatching { JSONArray(raw).length() > 0 }.getOrDefault(false)
    }

    fun enqueuePendingAttachment(
        context: Context,
        sessionId: String,
        uri: String,
        name: String,
        mimeType: String,
        size: Long,
        nonce: String
    ) {
        if (sessionId.isBlank() || uri.isBlank() || name.isBlank()) return
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val key = PENDING_ATTACHMENT_PREFIX + sessionId
        val pending = runCatching { JSONArray(prefs.getString(key, "[]")) }.getOrElse { JSONArray() }
        pending.put(JSONObject().apply {
            put("id", nonce)
            put("uri", uri)
            put("name", name)
            put("mimeType", mimeType)
            put("size", size)
            put("createdAt", System.currentTimeMillis())
        })
        prefs.edit().putString(key, pending.toString()).apply()
    }

    fun pendingAttachments(context: Context, sessionId: String): String {
        if (sessionId.isBlank()) return "[]"
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(PENDING_ATTACHMENT_PREFIX + sessionId, "[]") ?: "[]"
    }

    fun acknowledgePendingAttachment(context: Context, sessionId: String, attachmentId: String) {
        if (sessionId.isBlank() || attachmentId.isBlank()) return
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val key = PENDING_ATTACHMENT_PREFIX + sessionId
        val pending = runCatching { JSONArray(prefs.getString(key, "[]")) }.getOrElse { JSONArray() }
        val remaining = JSONArray()
        var consumedUri = ""
        for (index in 0 until pending.length()) {
            val item = pending.optJSONObject(index) ?: continue
            if (item.optString("id") == attachmentId) {
                consumedUri = item.optString("uri")
            } else {
                remaining.put(item)
            }
        }
        prefs.edit().putString(key, remaining.toString()).apply()
        runCatching {
            val path = android.net.Uri.parse(consumedUri).path
            if (!path.isNullOrBlank()) java.io.File(path).delete()
        }
    }

    fun appendOutgoingAttachment(context: Context, sessionId: String, name: String) {
        val existing = load(context, sessionId) ?: return
        val messages = JSONArray().apply {
            (existing.messages + ChatHeadMessage(name, outgoing = true, attachment = true)).forEach { message ->
                put(JSONObject().apply {
                    put("text", message.text)
                    put("outgoing", message.outgoing)
                    put("attachment", message.attachment)
                })
            }
        }
        save(context, sessionId, existing.title, existing.avatarUri, messages.toString(), existing.isWorking)
    }

    fun appendIncomingNotification(context: Context, sessionId: String, text: String) {
        val trimmed = text.trim()
        if (sessionId.isBlank() || trimmed.isBlank()) return
        val existing = load(context, sessionId) ?: return
        val last = existing.messages.lastOrNull()
        if (last != null && !last.outgoing && last.text == trimmed) return

        val messages = JSONArray().apply {
            (existing.messages + ChatHeadMessage(trimmed.take(1200), outgoing = false)).forEach { message ->
                put(JSONObject().apply {
                    put("text", message.text)
                    put("outgoing", message.outgoing)
                    put("attachment", message.attachment)
                })
            }
        }
        save(context, sessionId, existing.title, existing.avatarUri, messages.toString(), existing.isWorking)
    }

    fun setWorking(context: Context, sessionId: String, isWorking: Boolean) {
        val existing = load(context, sessionId) ?: return
        save(context, sessionId, existing.title, existing.avatarUri, null, isWorking)
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
                    outgoing = item.optBoolean("outgoing", false),
                    attachment = item.optBoolean("attachment", false)
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
                messages = parseMessages(payload.optJSONArray("messages")),
                isWorking = payload.optBoolean("isWorking", false),
                updatedAt = payload.optLong("updatedAt", 0L)
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
