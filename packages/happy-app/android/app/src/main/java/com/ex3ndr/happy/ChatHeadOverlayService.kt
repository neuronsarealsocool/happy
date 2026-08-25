package com.ex3ndr.happy

import android.app.Service
import android.content.Context
import android.content.Intent
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
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewOutlineProvider
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import kotlin.math.roundToInt

class ChatHeadOverlayService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null
    private var params: WindowManager.LayoutParams? = null

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
        val title = intent?.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "Happy" }
        val body = intent?.getStringExtra(EXTRA_BODY).orEmpty().ifBlank { "New message" }
        val sessionId = intent?.getStringExtra(EXTRA_SESSION_ID).orEmpty()
        val avatarUri = intent?.getStringExtra(EXTRA_AVATAR_URI).orEmpty()
        show(title, body, sessionId, avatarUri)
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        dismiss()
        super.onDestroy()
    }

    private fun show(title: String, body: String, sessionId: String, avatarUri: String) {
        if (!canDrawOverlays(this)) {
            Log.w(TAG, "Cannot show chat head: overlay permission is not granted")
            return
        }
        dismiss()

        val view = buildOverlay(title, body, sessionId, avatarUri)
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
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            android.graphics.PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            x = 0
            y = dp(28)
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

    private fun buildOverlay(title: String, body: String, sessionId: String, avatarUri: String): View {
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
            if (avatarUri.isNotBlank()) {
                runCatching { setImageURI(Uri.parse(avatarUri)) }
            }
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
            if (avatarUri.isNotBlank()) {
                runCatching { setImageURI(Uri.parse(avatarUri)) }
            }
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

        val message = TextView(this).apply {
            text = body
            setTextColor(Color.BLACK)
            textSize = 18f
            background = roundedDrawable(Color.rgb(239, 240, 244), dp(22).toFloat())
            setPadding(dp(18), dp(12), dp(18), dp(12))
            maxLines = 4
        }
        val messageParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        messageParams.setMargins(dp(64), dp(18), dp(8), dp(12))
        card.addView(message, messageParams)

        root.setOnClickListener { openHappy(sessionId) }
        installDrag(root)
        return root
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
                    runCatching { windowManager.updateViewLayout(view, p) }
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

    private fun openHappy(sessionId: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            data = if (sessionId.isNotBlank()) Uri.parse("happy://session/$sessionId") else Uri.parse("happy://")
        }
        startActivity(intent)
        dismiss()
    }

    private fun dismiss() {
        val view = overlayView ?: return
        overlayView = null
        params = null
        handler.post {
            runCatching { windowManager.removeView(view) }
                .onFailure { Log.w(TAG, "Failed to remove chat head view", it) }
        }
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
    }
}
