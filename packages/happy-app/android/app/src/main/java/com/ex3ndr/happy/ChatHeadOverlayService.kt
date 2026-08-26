package com.ex3ndr.happy

import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.text.InputType
import android.util.Base64
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewOutlineProvider
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat
import kotlin.math.roundToInt

class ChatHeadOverlayService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null
    private var params: WindowManager.LayoutParams? = null
    private var isExpanded = true
    private var currentSessionId = ""
    private val pendingReplies = mutableMapOf<String, MutableList<ChatHeadMessage>>()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_DISMISS) {
            dismiss()
            return START_NOT_STICKY
        }
        if (intent?.action == ACTION_REFRESH) {
            refreshVisibleSession(intent.getStringExtra(EXTRA_SESSION_ID).orEmpty())
            return START_NOT_STICKY
        }
        val title = intent?.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "Happy" }
        val body = intent?.getStringExtra(EXTRA_BODY).orEmpty().ifBlank { "New message" }
        val sessionId = intent?.getStringExtra(EXTRA_SESSION_ID).orEmpty()
        val avatarUri = intent?.getStringExtra(EXTRA_AVATAR_URI).orEmpty()
        val cached = ChatHeadSessionCache.load(this, sessionId)
            ?: ChatHeadSessionCache.findByNotification(this, title, body)
        val displayTitle = cached?.title?.takeIf { it.isNotBlank() } ?: title
        val displayAvatarUri = cached?.avatarUri?.takeIf { it.isNotBlank() } ?: avatarUri
        val displaySessionId = cached?.sessionId?.takeIf { it.isNotBlank() } ?: sessionId
        val displayMessages = cached?.messages?.takeIf { it.isNotEmpty() }
            ?: listOf(ChatHeadMessage(body, outgoing = false))
        show(displayTitle, displaySessionId, displayAvatarUri, displayMessages)
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        dismiss()
        super.onDestroy()
    }

    private fun show(title: String, sessionId: String, avatarUri: String, messages: List<ChatHeadMessage>) {
        if (!canDrawOverlays(this)) {
            Log.w(TAG, "Cannot show chat head: overlay permission is not granted")
            return
        }
        dismiss()
        isExpanded = true

        val view = buildOverlay(title, sessionId, avatarUri, messagesForDisplay(sessionId, messages))
        currentSessionId = sessionId
        val width = (resources.displayMetrics.widthPixels * 0.92f).roundToInt()
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }
        val layoutParams = WindowManager.LayoutParams(
            width,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            android.graphics.PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            x = 0
            y = dp(28)
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        }

        overlayView = view
        params = layoutParams
        try {
            windowManager.addView(view, layoutParams)
            Log.d(TAG, "Chat head view added")
        } catch (error: Exception) {
            Log.e(TAG, "Failed to add chat head view", error)
            overlayView = null
            params = null
            return
        }

        view.alpha = 0f
        view.translationY = -dp(32).toFloat()
        view.scaleX = 0.92f
        view.scaleY = 0.92f
        view.animate()
            .alpha(1f)
            .translationY(0f)
            .scaleX(1f)
            .scaleY(1f)
            .setDuration(320)
            .setInterpolator(OvershootInterpolator(0.8f))
            .start()
    }

    private fun buildOverlay(title: String, sessionId: String, avatarUri: String, messages: List<ChatHeadMessage>): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, 0, 0, dp(10))
        }

        val bubble = FrameLayout(this).apply {
            background = circleDrawable(Color.WHITE)
            elevation = dp(12).toFloat()
            outlineProvider = circleOutlineProvider(dp(78))
            clipToOutline = true
        }
        root.addView(bubble, LinearLayout.LayoutParams(dp(78), dp(78)))

        val avatar = ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            setImageResource(R.mipmap.ic_launcher_round)
            setAvatarImage(this, avatarUri)
        }
        bubble.addView(avatar, FrameLayout.LayoutParams(dp(58), dp(58), Gravity.CENTER))

        val badge = TextView(this).apply {
            text = "1"
            setTextColor(Color.WHITE)
            textSize = 14f
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
            background = circleDrawable(Color.rgb(255, 45, 85))
        }
        bubble.addView(badge, FrameLayout.LayoutParams(dp(26), dp(26), Gravity.TOP or Gravity.END))

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = roundedDrawable(Color.WHITE, dp(24).toFloat())
            elevation = dp(18).toFloat()
            setPadding(dp(18), dp(16), dp(18), dp(14))
        }
        val cardParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        cardParams.topMargin = dp(14)
        root.addView(card, cardParams)

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        card.addView(header, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        val smallAvatar = ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            setImageResource(R.mipmap.ic_launcher_round)
            outlineProvider = circleOutlineProvider(dp(52))
            clipToOutline = true
            setAvatarImage(this, avatarUri)
        }
        header.addView(smallAvatar, LinearLayout.LayoutParams(dp(52), dp(52)))

        val titleColumn = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), 0, 0, 0)
        }
        header.addView(titleColumn, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

        titleColumn.addView(TextView(this).apply {
            text = title
            setTextColor(Color.BLACK)
            textSize = 20f
            typeface = Typeface.DEFAULT_BOLD
            maxLines = 1
        })
        titleColumn.addView(TextView(this).apply {
            text = "Active now"
            setTextColor(Color.rgb(120, 120, 128))
            textSize = 15f
            maxLines = 1
        })

        val openButton = iconButton("Open") { openHappy(sessionId) }
        header.addView(openButton, LinearLayout.LayoutParams(dp(46), dp(46)))

        val closeButton = iconButton("X") { dismiss() }
        header.addView(closeButton, LinearLayout.LayoutParams(dp(46), dp(46)))

        val messagesColumn = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        val messagesScroll = ScrollView(this).apply {
            overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
            setPadding(0, dp(8), 0, 0)
        }
        val messagesHeight = (resources.displayMetrics.heightPixels * 0.42f)
            .roundToInt()
            .coerceAtLeast(dp(180))
            .coerceAtMost(dp(420))
        val focusedMessagesHeight = (resources.displayMetrics.heightPixels * 0.16f)
            .roundToInt()
            .coerceAtLeast(dp(120))
            .coerceAtMost(dp(180))
        card.addView(messagesScroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, messagesHeight))
        messagesScroll.addView(messagesColumn, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        messages.forEach { message ->
            appendMessageBubble(messagesColumn, message.text, outgoing = message.outgoing)
        }
        messagesScroll.post { messagesScroll.fullScroll(View.FOCUS_DOWN) }

        val inputRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(8), 0, 0)
        }
        card.addView(inputRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        val replyInput = EditText(this).apply {
            hint = "Aa"
            textSize = 16f
            setTextColor(Color.BLACK)
            setHintTextColor(Color.rgb(142, 142, 147))
            minHeight = dp(44)
            maxLines = 1
            background = roundedDrawable(Color.rgb(239, 240, 244), dp(22).toFloat())
            setPadding(dp(16), 0, dp(16), 0)
            isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or
                InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            imeOptions = EditorInfo.IME_ACTION_SEND or EditorInfo.IME_FLAG_NO_EXTRACT_UI
        }
        inputRow.addView(replyInput, LinearLayout.LayoutParams(0, dp(46), 1f))

        val sendReply = {
            val reply = replyInput.text?.toString()?.trim().orEmpty()
            if (reply.isNotEmpty()) {
                appendMessageBubble(messagesColumn, reply, outgoing = true)
                if (sessionId.isNotBlank()) {
                    pendingReplies.getOrPut(sessionId) { mutableListOf() }
                        .add(ChatHeadMessage(reply, outgoing = true))
                }
                messagesScroll.post { messagesScroll.fullScroll(View.FOCUS_DOWN) }
                replyInput.text?.clear()
                if (sessionId.isNotBlank()) {
                    openHappy(sessionId, reply, true, dismissOverlay = false)
                }
            }
        }
        replyInput.setOnEditorActionListener { _, actionId, event ->
            val isEnter = event?.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_UP
            if (actionId == EditorInfo.IME_ACTION_SEND || isEnter) {
                sendReply()
                true
            } else {
                false
            }
        }

        val sendButton = TextView(this).apply {
            text = "Send"
            setTextColor(Color.WHITE)
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            background = roundedDrawable(ContextCompat.getColor(context, android.R.color.holo_blue_light), dp(22).toFloat())
            setOnClickListener { sendReply() }
        }
        val sendParams = LinearLayout.LayoutParams(dp(74), dp(44))
        sendParams.leftMargin = dp(8)
        inputRow.addView(sendButton, sendParams)

        val openComposer = TextView(this).apply {
            text = "Open full conversation"
            setTextColor(ContextCompat.getColor(context, android.R.color.holo_blue_light))
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(0, dp(10), 0, 0)
            setOnClickListener {
                val draft = replyInput.text?.toString()?.trim().orEmpty()
                openHappy(sessionId, draft, false)
            }
        }
        card.addView(openComposer, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        installDrag(bubble)
        installDrag(header)
        bubble.setOnClickListener {
            isExpanded = !isExpanded
            card.visibility = if (isExpanded) View.VISIBLE else View.GONE
            overlayView?.let { view ->
                runCatching { windowManager.updateViewLayout(view, params) }
            }
        }
        replyInput.setOnFocusChangeListener { view, hasFocus ->
            messagesScroll.layoutParams = messagesScroll.layoutParams.apply {
                height = if (hasFocus) focusedMessagesHeight else messagesHeight
            }
            messagesScroll.post { messagesScroll.fullScroll(View.FOCUS_DOWN) }
            overlayView?.let { overlay ->
                runCatching { windowManager.updateViewLayout(overlay, params) }
            }
            if (hasFocus) {
                (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
                    .showSoftInput(view, InputMethodManager.SHOW_IMPLICIT)
            }
        }
        return root
    }

    private fun appendMessageBubble(container: LinearLayout, textValue: String, outgoing: Boolean) {
        val message = TextView(this).apply {
            text = textValue
            setTextColor(if (outgoing) Color.WHITE else Color.BLACK)
            textSize = 18f
            background = roundedDrawable(
                if (outgoing) ContextCompat.getColor(context, android.R.color.holo_blue_light) else Color.rgb(239, 240, 244),
                dp(22).toFloat()
            )
            setPadding(dp(18), dp(12), dp(18), dp(12))
        }
        val messageParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        messageParams.gravity = if (outgoing) Gravity.END else Gravity.START
        if (outgoing) {
            messageParams.setMargins(dp(64), dp(8), dp(8), dp(8))
        } else {
            messageParams.setMargins(dp(64), dp(18), dp(8), dp(12))
        }
        container.addView(message, messageParams)
    }

    private fun setAvatarImage(imageView: ImageView, avatarUri: String) {
        if (avatarUri.isBlank()) return
        if (avatarUri.startsWith("data:image/")) {
            val base64Data = avatarUri.substringAfter("base64,", missingDelimiterValue = "")
            if (base64Data.isNotBlank()) {
                runCatching {
                    val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    if (bitmap != null) {
                        imageView.setImageBitmap(bitmap)
                    }
                }.onFailure { Log.w(TAG, "Failed to decode chat head avatar", it) }
            }
            return
        }

        runCatching { imageView.setImageURI(Uri.parse(avatarUri)) }
            .onFailure { Log.w(TAG, "Failed to load chat head avatar URI", it) }
    }

    private fun installDrag(view: View) {
        var startX = 0
        var startY = 0
        var touchX = 0f
        var touchY = 0f
        view.setOnTouchListener { _, event ->
            val p = params ?: return@setOnTouchListener false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startX = p.x
                    startY = p.y
                    touchX = event.rawX
                    touchY = event.rawY
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    p.x = startX + (event.rawX - touchX).roundToInt()
                    p.y = (startY + (event.rawY - touchY).roundToInt()).coerceAtLeast(0)
                    overlayView?.let { overlay ->
                        runCatching { windowManager.updateViewLayout(overlay, p) }
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun iconButton(textValue: String, action: () -> Unit): ImageButton {
        return ImageButton(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            contentDescription = if (textValue == "X") "Close chat head" else "Open Happy"
            setImageDrawable(TextDrawable(textValue, ContextCompat.getColor(context, android.R.color.holo_blue_light)))
            setOnClickListener { action() }
        }
    }

    private fun openHappy(sessionId: String, draft: String = "", send: Boolean = false, dismissOverlay: Boolean = true) {
        val uri = buildHappySessionUri(sessionId, draft, send)
        val intent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            data = uri
        }
        startActivity(intent)
        if (dismissOverlay) {
            dismiss()
        }
    }

    private fun buildHappySessionUri(sessionId: String, draft: String = "", send: Boolean = false): Uri {
        if (sessionId.isBlank()) {
            return Uri.parse("happy:///")
        }

        val uri = StringBuilder("happy:///session/")
            .append(Uri.encode(sessionId))
        if (draft.isNotBlank()) {
            uri.append("?chatHeadDraft=")
                .append(Uri.encode(draft))
                .append("&chatHeadSend=")
                .append(if (send) "1" else "0")
        }
        return Uri.parse(uri.toString())
    }

    private fun dismiss() {
        val view = overlayView ?: return
        overlayView = null
        params = null
        currentSessionId = ""
        handler.post {
            runCatching { windowManager.removeView(view) }
                .onFailure { Log.w(TAG, "Failed to remove chat head view", it) }
        }
    }

    private fun refreshVisibleSession(sessionId: String) {
        if (overlayView == null || sessionId.isBlank() || sessionId != currentSessionId) {
            return
        }
        val cached = ChatHeadSessionCache.load(this, sessionId) ?: return
        show(cached.title.ifBlank { "Happy" }, cached.sessionId, cached.avatarUri, cached.messages)
    }

    private fun messagesForDisplay(sessionId: String, cachedMessages: List<ChatHeadMessage>): List<ChatHeadMessage> {
        if (sessionId.isBlank()) return cachedMessages
        val pending = pendingReplies[sessionId].orEmpty()
        if (pending.isEmpty()) return cachedMessages

        val remainingPending = pending.filterNot { pendingMessage ->
            cachedMessages.any { cachedMessage ->
                cachedMessage.outgoing == pendingMessage.outgoing && cachedMessage.text == pendingMessage.text
            }
        }
        if (remainingPending.isEmpty()) {
            pendingReplies.remove(sessionId)
            return cachedMessages
        }
        pendingReplies[sessionId] = remainingPending.toMutableList()
        return cachedMessages + remainingPending
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()

    private fun roundedDrawable(color: Int, radius: Float): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            setColor(color)
            cornerRadius = radius
        }
    }

    private fun circleDrawable(color: Int): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(color)
        }
    }

    private fun circleOutlineProvider(size: Int): ViewOutlineProvider {
        return object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: Outline) {
                outline.setOval(0, 0, size, size)
            }
        }
    }

    companion object {
        const val ACTION_DISMISS = "com.ex3ndr.happy.chathead.DISMISS"
        const val ACTION_REFRESH = "com.ex3ndr.happy.chathead.REFRESH"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
        const val EXTRA_SESSION_ID = "sessionId"
        const val EXTRA_AVATAR_URI = "avatarUri"
        private const val TAG = "HappyChatHead"

        fun canDrawOverlays(context: Context): Boolean {
            return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
        }

        fun start(context: Context, title: String?, body: String?, sessionId: String?, avatarUri: String?) {
            val intent = Intent(context, ChatHeadOverlayService::class.java).apply {
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_BODY, body)
                putExtra(EXTRA_SESSION_ID, sessionId)
                putExtra(EXTRA_AVATAR_URI, avatarUri)
            }
            context.startService(intent)
        }

        fun refresh(context: Context, sessionId: String) {
            if (sessionId.isBlank()) return
            val intent = Intent(context, ChatHeadOverlayService::class.java).apply {
                action = ACTION_REFRESH
                putExtra(EXTRA_SESSION_ID, sessionId)
            }
            context.startService(intent)
        }
    }
}
