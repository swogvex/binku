// Report sheet (12-moderation-safety): pick a reason, optional details, optionally block too.
// Target: one message (?message=), the conversation (?conversation=) or the user (?other=).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { block, chatError, report, type ReportReason } from '@/data/chat';
import { refreshChats } from '@/features/chat/useChats';
import { refreshMatches } from '@/features/matches/useMatches';
import { t, type TKey } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { fonts, radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/icons/Icon';
import { Txt } from '@/ui/Txt';

const REASONS: ReportReason[] = [
  'harassment',
  'personal_data',
  'scam',
  'fake',
  'sexual',
  'spam',
  'in_person',
  'other',
];

export default function ReportSheet() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = useLocalSearchParams<{
    message?: string;
    conversation?: string;
    other: string;
    username: string;
  }>();
  const [reason, setReason] = useState<ReportReason>();
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<TKey | null>(null);

  const submit = async () => {
    if (!reason) return;
    setState('sending');
    setError(null);
    try {
      await report(
        p.message
          ? { message: Number(p.message) }
          : p.conversation
            ? { conversation: p.conversation }
            : { user: p.other },
        reason,
        details.trim() || undefined,
      );
      if (alsoBlock) await block(p.other);
      haptics.success();
      void refreshChats();
      void refreshMatches();
      setState('done');
    } catch (e) {
      setError(chatError(e));
      setState('idle');
    }
  };

  if (state === 'done')
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.surface,
          padding: screenPadding,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: c.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="shield" size={34} />
        </View>
        <Txt
          variant="title"
          size={22}
          style={{ textAlign: 'center' }}
          accessibilityLiveRegion="polite"
        >
          {t('chat.reported')}
        </Txt>
        {alsoBlock ? (
          <Txt size={15} muted style={{ textAlign: 'center' }}>
            {t('chat.blocked', { username: p.username })}
          </Txt>
        ) : null}
        <Button
          label={t('cardSheet.back')}
          onPress={() => router.back()}
          style={{ alignSelf: 'stretch' }}
        />
      </View>
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.surface }}
      contentContainerStyle={{
        padding: screenPadding,
        paddingTop: 28,
        paddingBottom: insets.bottom + 24,
        gap: 16,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: 6 }}>
        <Txt variant="display" size={28} accessibilityRole="header">
          {t(p.message ? 'chat.reportMessage' : 'chat.reportTitle')}
        </Txt>
        <Txt size={15} muted>
          {t('chat.reportIntro', { username: p.username })}
        </Txt>
      </View>

      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
        {REASONS.map((r) => {
          const selected = reason === r;
          return (
            <Pressable
              key={r}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => {
                haptics.selection();
                setReason(r);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 50,
                paddingHorizontal: 14,
                borderRadius: radius.control,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? c.ink : c.line,
                backgroundColor: selected ? c.surface2 : c.surface,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: selected ? c.ink : c.muted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selected ? (
                  <View
                    style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.ink }}
                  />
                ) : null}
              </View>
              <Txt variant={selected ? 'title' : 'body'} size={15} style={{ flex: 1 }}>
                {t(`chat.reason.${r}`)}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={details}
        onChangeText={setDetails}
        placeholder={t('chat.details')}
        placeholderTextColor={c.muted}
        accessibilityLabel={t('chat.details')}
        multiline
        maxLength={500}
        style={{
          minHeight: 88,
          padding: 14,
          borderRadius: radius.control,
          borderWidth: 1,
          borderColor: c.line,
          color: c.ink,
          fontFamily: fonts.text400,
          fontSize: 15,
          textAlignVertical: 'top',
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Txt variant="label" size={15} style={{ flex: 1 }}>
          {t('chat.alsoBlock', { username: p.username })}
        </Txt>
        <Switch
          value={alsoBlock}
          onValueChange={setAlsoBlock}
          accessibilityLabel={t('chat.alsoBlock', { username: p.username })}
          trackColor={{ true: c.ink, false: c.line }}
        />
      </View>

      {error ? (
        <Txt size={13} color={c.accentText} accessibilityLiveRegion="polite">
          {t(error)}
        </Txt>
      ) : null}
      <Button
        label={t('chat.sendReport')}
        icon="flag"
        disabled={!reason || state === 'sending'}
        onPress={submit}
      />
    </ScrollView>
  );
}
