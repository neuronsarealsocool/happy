import * as React from "react";
import { View, Text, Platform, Pressable } from "react-native";
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { MarkdownView } from "./markdown/MarkdownView";
import { t } from '@/text';
import { Message, UserTextMessage, AgentTextMessage, ToolCallMessage } from "@/sync/typesMessage";
import { Metadata } from "@/sync/storageTypes";
import { ToolView } from "./tools/ToolView";
import { AgentEvent } from "@/sync/typesRaw";
import { sync } from '@/sync/sync';
import { useSetting } from '@/sync/storage';
import { Option } from './markdown/MarkdownView';
import { layout } from "./layout";
import { parseLocalCommandMessage, isUserSlashCommandEcho } from './parseLocalCommandMessage';
import { resolveUserMessageBubbleColor } from '@/utils/userMessageBubbleColor';
import { discoverPreviewTargetsInText, type SessionPreviewTargetKind } from '@/utils/sessionPreviewTargets';
import { registerSessionPreview } from '@/-session/sessionPreviewStore';

function CopyHoverFrame(props: {
  text: string;
  align: 'left' | 'right';
  children: React.ReactNode;
}) {
  const { theme } = useUnistyles();
  const [isHovered, setIsHovered] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const copiedTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showCopyButton = Platform.OS === 'web' && isHovered && props.text.trim().length > 0;

  React.useEffect(() => () => {
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
  }, []);

  const handleCopy = React.useCallback(async () => {
    const text = props.text.trim();
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setCopied(true);
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    copiedTimeoutRef.current = setTimeout(() => setCopied(false), 1200);
  }, [props.text]);

  const webHoverProps = Platform.OS === 'web'
    ? {
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
    }
    : {};

  return (
    <View
      {...webHoverProps}
      style={styles.copyFrame}
    >
      {props.children}
      {showCopyButton ? (
        <Pressable
          accessibilityLabel={copied ? t('common.copied') : 'Copy message'}
          onPress={handleCopy}
          hitSlop={8}
          style={[
            styles.copyButton,
            props.align === 'right' ? styles.copyButtonRight : styles.copyButtonLeft,
            { backgroundColor: theme.colors.surfaceHigh, borderColor: theme.colors.divider },
          ]}
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={15}
            color={copied ? theme.colors.success : theme.colors.textSecondary}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

export const MessageView = React.memo((props: {
  message: Message;
  metadata: Metadata | null;
  sessionId: string;
  getMessageById?: (id: string) => Message | null;
}) => {
  return (
    <View
      style={styles.messageContainer}
      renderToHardwareTextureAndroid={Platform.OS !== 'web'}
    >
      <View style={styles.messageContent}>
        <RenderBlock
          message={props.message}
          metadata={props.metadata}
          sessionId={props.sessionId}
          getMessageById={props.getMessageById}
        />
      </View>
    </View>
  );
});

// RenderBlock function that dispatches to the correct component based on message kind
function RenderBlock(props: {
  message: Message;
  metadata: Metadata | null;
  sessionId: string;
  getMessageById?: (id: string) => Message | null;
}): React.ReactElement {
  switch (props.message.kind) {
    case 'user-text':
      return (
        <UserTextBlock
          message={props.message}
          metadata={props.metadata}
          sessionId={props.sessionId}
        />
      );

    case 'agent-text':
      return <AgentTextBlock message={props.message} metadata={props.metadata} sessionId={props.sessionId} />;

    case 'tool-call':
      return <ToolCallBlock
        message={props.message}
        metadata={props.metadata}
        sessionId={props.sessionId}
        getMessageById={props.getMessageById}
      />;

    case 'agent-event':
      return <AgentEventBlock event={props.message.event} metadata={props.metadata} />;


    default:
      // Exhaustive check - TypeScript will error if we miss a case
      const _exhaustive: never = props.message;
      throw new Error(`Unknown message kind: ${_exhaustive}`);
  }
}

function UserTextBlock(props: {
  message: UserTextMessage;
  metadata: Metadata | null;
  sessionId: string;
}) {
  const handleOptionPress = React.useCallback((option: Option) => {
    sync.sendMessage(props.sessionId, option.title, { source: 'option' });
  }, [props.sessionId]);

  const userMessageBubbleColor = useSetting('userMessageBubbleColor');
  const { theme } = useUnistyles();
  const bubblePalette = resolveUserMessageBubbleColor(userMessageBubbleColor, theme.dark);
  const bubbleStyle = {
    backgroundColor: bubblePalette.background,
    borderColor: bubblePalette.border,
  };
  // Claude Agent SDK emits synthetic user messages wrapped in tags like
  // <local-command-caveat>…</local-command-caveat> and
  // <command-message>…</command-message><command-name>/foo</command-name>
  // whenever a slash command runs. The plain MarkdownView renders these as
  // literal text, which looks broken. Collapse them into chips or hide
  // them entirely depending on what kind of wrapper this is.
  // The user's own slash-command input is shown optimistically (carries a
  // localId); the SDK then injects the canonical wrapper chip. Hide the raw
  // echo so we don't render the command twice. Gated to Claude flavor only:
  // Codex/Gemini don't reliably emit the <command-*> wrapper, so hiding the
  // echo there would drop the command with nothing to replace it. (Absent
  // flavor == Claude, matching the convention used elsewhere.)
  const isClaudeFlavor = !props.metadata?.flavor || props.metadata.flavor === 'claude';
  if (isClaudeFlavor && isUserSlashCommandEcho(props.message.text, props.message.localId != null)) {
    return null;
  }

  const parsed = parseLocalCommandMessage(props.message.displayText || props.message.text);
  if (parsed.kind === 'caveat') {
    return null;
  }
  if (parsed.kind === 'goal-confirmation') {
    return null;
  }
  if (parsed.kind === 'goal-run') {
    return (
      <View style={styles.userMessageContainer}>
        <CopyHoverFrame text={props.message.displayText || props.message.text} align="right">
          <View style={[styles.userMessageBubble, styles.userMessageBubbleSolid, bubbleStyle, styles.goalMessageBubble]}>
            <MarkdownView markdown={parsed.goal} onOptionPress={handleOptionPress} sessionId={props.sessionId} textColor={theme.colors.userMessageText} />
          </View>
        </CopyHoverFrame>
        <View style={styles.goalSentRow}>
          <Ionicons name="locate-outline" size={16} color={styles.goalSentText.color} />
          <Text style={styles.goalSentText}>{t('message.sentAsGoal')}</Text>
        </View>
      </View>
    );
  }
  if (parsed.kind === 'command-run') {
    return (
      <View style={styles.userMessageContainer}>
        {parsed.args ? (
          <CopyHoverFrame text={props.message.displayText || props.message.text} align="right">
            <View style={[styles.userMessageBubble, styles.userMessageBubbleSolid, bubbleStyle, styles.commandMessageBubble]}>
              <MarkdownView markdown={parsed.args} onOptionPress={handleOptionPress} sessionId={props.sessionId} textColor={theme.colors.userMessageText} />
            </View>
          </CopyHoverFrame>
        ) : null}
        <View style={[styles.commandChip, styles.userMessageBubbleSolid, bubbleStyle]}>
          <Text style={styles.commandChipText}>/{parsed.commandName}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.userMessageContainer}>
      {/* Text owns long-press so native selection / Markdown Copy v2 can work
          without also opening the rewind picker. Rewind remains in session actions. */}
      <CopyHoverFrame text={props.message.displayText || props.message.text} align="right">
        <View style={[styles.userMessageBubble, styles.userMessageBubbleSolid, bubbleStyle]}>
          <MarkdownView markdown={parsed.text} onOptionPress={handleOptionPress} sessionId={props.sessionId} textColor={theme.colors.userMessageText} />
        </View>
      </CopyHoverFrame>
    </View>
  );
}

function AgentTextBlock(props: {
  message: AgentTextMessage;
  metadata: Metadata | null;
  sessionId: string;
}) {
  const handleOptionPress = React.useCallback((option: Option) => {
    sync.sendMessage(props.sessionId, option.title, { source: 'option' });
  }, [props.sessionId]);

  // Hide thinking messages
  if (props.message.isThinking) {
    return null;
  }

  return (
    <View style={styles.agentMessageContainer}>
      <CopyHoverFrame text={props.message.text} align="left">
        <View style={styles.agentMessageBubble}>
          <MarkdownView markdown={props.message.text} onOptionPress={handleOptionPress} sessionId={props.sessionId} />
        </View>
      </CopyHoverFrame>
      <ArtifactActionRow
        text={props.message.text}
        projectPath={props.metadata?.path}
        sessionId={props.sessionId}
      />
    </View>
  );
}

function ArtifactActionRow(props: {
  text: string;
  projectPath?: string | null;
  sessionId: string;
}) {
  const { theme } = useUnistyles();
  const targets = React.useMemo(
    () => discoverPreviewTargetsInText(props.text, { projectPath: props.projectPath }, 4),
    [props.projectPath, props.text],
  );

  if (targets.length === 0) {
    return null;
  }

  return (
    <View style={styles.artifactRow}>
      {targets.map((target) => (
        <Pressable
          key={`${target.kind}:${target.uri}`}
          accessibilityRole="button"
          accessibilityLabel={`Preview ${target.title}`}
          onPress={() => registerSessionPreview(props.sessionId, {
            uri: target.uri,
            title: target.title,
            kind: target.kind as SessionPreviewTargetKind,
          })}
          style={({ pressed }) => [
            styles.artifactButton,
            { borderColor: theme.colors.divider, backgroundColor: theme.colors.surfaceHigh },
            pressed && styles.artifactButtonPressed,
          ]}
        >
          <Ionicons
            name={artifactIconName(target.kind, target.title)}
            size={15}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.artifactButtonText} numberOfLines={1}>
            {target.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function artifactIconName(kind: SessionPreviewTargetKind, title: string): React.ComponentProps<typeof Ionicons>['name'] {
  if (kind === 'url') return 'globe-outline';
  const lower = title.toLowerCase();
  if (lower.endsWith('.pdf')) return 'document-text-outline';
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(lower)) return 'image-outline';
  if (/\.(html?|md)$/.test(lower)) return 'document-outline';
  return 'attach-outline';
}

function AgentEventBlock(props: {
  event: AgentEvent;
  metadata: Metadata | null;
}) {
  if (props.event.type === 'switch') {
    return (
      <View style={styles.agentEventContainer}>
        <Text style={styles.agentEventText}>{t('message.switchedToMode', { mode: props.event.mode })}</Text>
      </View>
    );
  }
  if (props.event.type === 'message') {
    return (
      <View style={styles.agentEventContainer}>
        <Text style={styles.agentEventText}>{props.event.message}</Text>
      </View>
    );
  }
  if (props.event.type === 'limit-reached') {
    const formatTime = (timestamp: number): string => {
      try {
        const date = new Date(timestamp * 1000); // Convert from Unix timestamp
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return t('message.unknownTime');
      }
    };

    return (
      <View style={styles.agentEventContainer}>
        <Text style={styles.agentEventText}>
          {t('message.usageLimitUntil', { time: formatTime(props.event.endsAt) })}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.agentEventContainer}>
      <Text style={styles.agentEventText}>{t('message.unknownEvent')}</Text>
    </View>
  );
}

function ToolCallBlock(props: {
  message: ToolCallMessage;
  metadata: Metadata | null;
  sessionId: string;
  getMessageById?: (id: string) => Message | null;
}) {
  if (!props.message.tool) {
    return null;
  }
  return (
    <View style={styles.toolContainer}>
      <ToolView
        tool={props.message.tool}
        metadata={props.metadata}
        messages={props.message.children}
        sessionId={props.sessionId}
        messageId={props.message.id}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  messageContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  messageContent: {
    flexDirection: 'column',
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    maxWidth: layout.maxWidth,
    overflow: 'hidden',
  },
  copyFrame: {
    position: 'relative',
    maxWidth: '100%',
  },
  copyButton: {
    position: 'absolute',
    top: -10,
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: theme.colors.shadow.color,
    shadowOpacity: theme.colors.shadow.opacity,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  copyButtonLeft: {
    left: 0,
  },
  copyButtonRight: {
    right: 0,
  },
  userMessageContainer: {
    maxWidth: '100%',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
  },
  userMessageBubble: {
    backgroundColor: theme.colors.userMessageBackground,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 8,
    maxWidth: '84%',
  },
  userMessageBubbleSolid: {
    borderWidth: 0,
    overflow: 'hidden',
  },
  goalMessageBubble: {
    marginBottom: 6,
  },
  commandMessageBubble: {
    marginBottom: 6,
  },
  goalSentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    maxWidth: '100%',
    opacity: 0.72,
  },
  goalSentText: {
    color: theme.colors.agentEventText,
    fontSize: 14,
  },
  commandChip: {
    backgroundColor: theme.colors.userMessageBackground,
    borderColor: theme.colors.userMessageBackground,
    borderWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 12,
    maxWidth: '100%',
  },
  commandChipText: {
    color: theme.colors.userMessageText,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  agentMessageContainer: {
    alignItems: 'flex-start',
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 20,
    maxWidth: '100%',
  },
  agentMessageBubble: {
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceHigh,
  },
  artifactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    maxWidth: '86%',
  },
  artifactButton: {
    minWidth: 0,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    cursor: 'pointer',
  },
  artifactButtonPressed: {
    opacity: 0.72,
  },
  artifactButtonText: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 280,
  },
  agentEventContainer: {
    marginHorizontal: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  agentEventText: {
    color: theme.colors.agentEventText,
    fontSize: 14,
  },
  toolContainer: {
    marginHorizontal: 8,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  debugText: {
    color: theme.colors.agentEventText,
    fontSize: 12,
  },
}));
