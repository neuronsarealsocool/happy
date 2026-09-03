package com.ex3ndr.happy

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.widget.Toast
import java.io.File

class ChatHeadFilePickerActivity : Activity() {
    private var sessionId = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sessionId = intent.getStringExtra(EXTRA_SESSION_ID)?.trim().orEmpty()
        if (sessionId.isBlank()) {
            finish()
            return
        }
        if (savedInstanceState == null) {
            startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }, REQUEST_FILES)
        }
    }

    @Deprecated("Deprecated in Android")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_FILES || resultCode != RESULT_OK || data == null) {
            finish()
            return
        }

        val uris = mutableListOf<Uri>()
        data.clipData?.let { clip ->
            for (index in 0 until clip.itemCount) uris.add(clip.getItemAt(index).uri)
        }
        data.data?.let { if (!uris.contains(it)) uris.add(it) }

        var queued = 0
        var rejected = 0
        uris.take(MAX_FILES).forEach { sourceUri ->
            val details = queryDetails(sourceUri)
            if (details.second > MAX_FILE_SIZE) {
                rejected++
                return@forEach
            }
            runCatching {
                val uploadDirectory = File(cacheDir, "chat-head-uploads").apply { mkdirs() }
                val safeName = details.first.replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "attachment" }
                val nonce = System.currentTimeMillis().toString() + "-" + queued
                val target = File(uploadDirectory, "$nonce-$safeName")
                contentResolver.openInputStream(sourceUri).use { input ->
                    requireNotNull(input) { "Unable to read selected file" }
                    target.outputStream().use { output -> input.copyTo(output) }
                }
                if (target.length() > MAX_FILE_SIZE) {
                    target.delete()
                    error("Selected file exceeds the 10 MB maximum")
                }
                val mimeType = contentResolver.getType(sourceUri) ?: "application/octet-stream"
                ChatHeadSessionCache.enqueuePendingAttachment(
                    this,
                    sessionId,
                    Uri.fromFile(target).toString(),
                    details.first,
                    mimeType,
                    target.length(),
                    nonce
                )
                ChatHeadSessionCache.appendOutgoingAttachment(this, sessionId, details.first)
                queued++
            }.onFailure { rejected++ }
        }

        if (queued > 0) {
            ChatHeadSessionCache.setWorking(this, sessionId, true)
            ChatHeadOverlayService.refresh(this, sessionId)
            ChatHeadReplyService.start(this, sessionId)
            Toast.makeText(this, if (queued == 1) "Uploading file" else "Uploading $queued files", Toast.LENGTH_SHORT).show()
        }
        if (rejected > 0) {
            Toast.makeText(this, "$rejected file(s) could not be attached (10 MB maximum)", Toast.LENGTH_LONG).show()
        }
        finish()
    }

    private fun queryDetails(uri: Uri): Pair<String, Long> {
        var name = "attachment-${System.currentTimeMillis()}"
        var size = 0L
        var cursor: Cursor? = null
        try {
            cursor = contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
            if (cursor?.moveToFirst() == true) {
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (nameIndex >= 0) name = cursor.getString(nameIndex) ?: name
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
            }
        } finally {
            cursor?.close()
        }
        return name to size
    }

    companion object {
        private const val EXTRA_SESSION_ID = "sessionId"
        private const val REQUEST_FILES = 8204
        private const val MAX_FILES = 20
        private const val MAX_FILE_SIZE = 10L * 1024L * 1024L

        fun open(context: Context, sessionId: String) {
            if (sessionId.isBlank()) return
            context.startActivity(Intent(context, ChatHeadFilePickerActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                putExtra(EXTRA_SESSION_ID, sessionId)
            })
        }
    }
}
