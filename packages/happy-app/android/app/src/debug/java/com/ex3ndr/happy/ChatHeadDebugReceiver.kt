package com.ex3ndr.happy

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ChatHeadDebugReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        ChatHeadOverlayService.start(
            context,
            intent.getStringExtra(ChatHeadOverlayService.EXTRA_TITLE),
            intent.getStringExtra(ChatHeadOverlayService.EXTRA_BODY),
            intent.getStringExtra(ChatHeadOverlayService.EXTRA_SESSION_ID),
            intent.getStringExtra(ChatHeadOverlayService.EXTRA_AVATAR_URI)
        )
    }
}
