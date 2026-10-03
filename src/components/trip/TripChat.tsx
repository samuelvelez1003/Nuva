import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, X } from 'lucide-react-native';
import { IconButton, Tap } from '../ui/Button';
import { Row } from '../ui/primitives';
import { Txt } from '../ui/Txt';
import { useT } from '../../i18n';
import { clock } from '../../lib/format';
import { fetchMessages, sendMessage, TripMessage, watchMessages } from '../../lib/liveTrips';
import { colors, fonts, radius, space } from '../../theme/tokens';

/**
 * Messages of one trip, live. Kept by the ride screen (even while the chat is closed)
 * so it can show how many arrived unread.
 */
export function useTripChat(tripId: string | undefined, myId: string | undefined, open: boolean) {
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    setMessages([]);
    setSeen(0);
    if (!tripId) return;
    let alive = true;
    fetchMessages(tripId)
      .then((list) => alive && setMessages(list))
      .catch(() => {});
    const unsub = watchMessages(tripId, (m) => setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m])));
    return () => {
      alive = false;
      unsub();
    };
  }, [tripId]);
  const fromOther = messages.filter((m) => m.sender_id !== myId).length;
  useEffect(() => {
    if (open) setSeen(fromOther);
  }, [open, fromOther]);
  return { messages, unread: open ? 0 : Math.max(0, fromOther - seen) };
}

/** Quick replies, so a driver can answer without typing. */
const QUICK = ['chat.quick.onMyWay', 'chat.quick.here', 'chat.quick.wait', 'chat.quick.where'] as const;

export function TripChat({
  visible,
  onClose,
  tripId,
  myId,
  otherName,
  messages,
  tone = 'light',
}: {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  myId: string;
  otherName: string;
  messages: TripMessage[];
  tone?: 'light' | 'dark';
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const dark = tone === 'dark';
  const bg = dark ? colors.midnight : colors.ivory100;
  const fg = dark ? colors.ivory : colors.ink;

  useEffect(() => {
    if (visible) setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 50);
  }, [visible, messages.length]);

  const send = async (body: string) => {
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(tripId, body);
      setText('');
    } catch {
      setError(t('chat.sendError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Row style={{ paddingTop: insets.top + space[3], paddingHorizontal: space[4], paddingBottom: space[3], gap: 12, borderBottomWidth: 1, borderBottomColor: dark ? colors.lineDark : colors.lineLight }}>
          <View style={{ flex: 1 }}>
            <Txt v="title" color={fg} numberOfLines={1}>
              {otherName}
            </Txt>
            <Txt v="caption" color={dark ? colors.onDarkMuted : colors.inkMuted}>
              {t('chat.subtitle')}
            </Txt>
          </View>
          <IconButton icon={X} label={t('chat.close')} tone={dark ? 'dark' : 'light'} size={42} onPress={onClose} />
        </Row>

        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: space[4], gap: 8 }}>
          {messages.length ? null : (
            <Txt v="small" align="center" color={dark ? colors.onDarkMuted : colors.inkMuted} style={{ marginTop: space[6] }}>
              {t('chat.empty')}
            </Txt>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === myId;
            return (
              <View
                key={m.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: radius.lg,
                  backgroundColor: mine ? colors.lime : dark ? colors.midnight700 : colors.white,
                  borderWidth: mine ? 0 : 1,
                  borderColor: dark ? colors.lineDark : colors.lineLight,
                }}
              >
                <Txt v="body" color={mine ? colors.midnight : fg}>
                  {m.body}
                </Txt>
                <Txt v="caption" color={mine ? colors.midnight : dark ? colors.onDarkFaint : colors.inkMuted} style={{ marginTop: 2, opacity: 0.8 }}>
                  {clock(new Date(m.created_at))}
                </Txt>
              </View>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: space[4], paddingBottom: 8 }}>
          {QUICK.map((k) => (
            <Tap key={k} onPress={() => send(t(k))} style={{ paddingHorizontal: 14, height: 34, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: dark ? colors.lineDarkStrong : colors.lineLightStrong }}>
              <Txt v="smallStrong" color={fg}>
                {t(k)}
              </Txt>
            </Tap>
          ))}
        </ScrollView>
        {error ? (
          <Txt v="caption" color={colors.danger} style={{ paddingHorizontal: space[4], paddingBottom: 6 }}>
            {error}
          </Txt>
        ) : null}
        <Row style={{ gap: 10, paddingHorizontal: space[4], paddingTop: 6, paddingBottom: insets.bottom + space[3] }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={dark ? colors.onDarkFaint : colors.stone}
            accessibilityLabel={t('chat.placeholder')}
            maxLength={500}
            onSubmitEditing={() => send(text)}
            returnKeyType="send"
            style={[
              { flex: 1, height: 48, borderRadius: radius.pill, paddingHorizontal: 18, fontFamily: fonts.medium, fontSize: 15, color: fg, backgroundColor: dark ? colors.midnight700 : colors.white, borderWidth: 1, borderColor: dark ? colors.lineDark : colors.lineLight },
              { outlineStyle: 'none' } as object,
            ]}
          />
          <IconButton icon={Send} label={t('chat.send')} tone={dark ? 'dark' : 'light'} size={48} onPress={() => send(text)} />
        </Row>
      </KeyboardAvoidingView>
    </Modal>
  );
}
