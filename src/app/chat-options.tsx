// ⋯ sheet of a conversation: Denunciar (first, so reporting is 2 taps), Bloquear, Silenciar.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { block, setMuted, unblock } from '@/data/chat';
import { refreshChats } from '@/features/chat/useChats';
import { refreshMatches } from '@/features/matches/useMatches';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon, type IconName } from '@/ui/icons/Icon';
import { Txt } from '@/ui/Txt';

function Row({
  icon,
  title,
  body,
  danger,
  onPress,
}: {
  icon: IconName;
  title: string;
  body: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  const color = danger ? c.accentText : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="title" size={15} color={color}>
          {title}
        </Txt>
        <Txt size={13} muted>
          {body}
        </Txt>
      </View>
      <Icon name="chevronRight" size={18} color={c.muted} />
    </Pressable>
  );
}

export default function ChatOptions() {
  const c = useTheme();
  const router = useRouter();
  const p = useLocalSearchParams<{
    conversation: string;
    other: string;
    username: string;
    muted?: string;
    blocked?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [problem, setProblem] = useState(false);
  const fail = () => setProblem(true);

  const done = () => {
    haptics.success();
    void refreshChats();
    void refreshMatches();
    router.back();
  };

  const askBlock = () =>
    Alert.alert(t('chat.blockTitle', { username: p.username }), t('chat.blockConfirm'), [
      { text: t('photo.cancel'), style: 'cancel' },
      {
        text: t('chat.blockOk'),
        style: 'destructive',
        onPress: () => block(p.other).then(done, fail),
      },
    ]);

  return (
    // sized to its rows (fitToContents): no flex, or the sheet grows to half the screen
    <View
      style={{
        backgroundColor: c.surface,
        padding: screenPadding,
        paddingTop: 28,
        paddingBottom: insets.bottom + 16,
      }}
    >
      <Txt variant="title" size={22} accessibilityRole="header" style={{ marginBottom: 6 }}>
        @{p.username}
      </Txt>
      <Row
        icon="flag"
        title={t('chat.report')}
        body={t('chat.reportBody')}
        danger
        onPress={() =>
          router.replace({
            pathname: '/report',
            params: { conversation: p.conversation, other: p.other, username: p.username },
          })
        }
      />
      {p.blocked ? (
        <Row
          icon="block"
          title={t('chat.unblock', { username: p.username })}
          body={t('chat.blockBody')}
          onPress={() => unblock(p.other).then(done, fail)}
        />
      ) : (
        <Row
          icon="block"
          title={t('chat.block', { username: p.username })}
          body={t('chat.blockBody')}
          danger
          onPress={askBlock}
        />
      )}
      {p.conversation ? (
        <Row
          icon={p.muted ? 'bell' : 'bellOff'}
          title={p.muted ? t('chat.unmute') : t('chat.mute')}
          body={t('chat.muteBody')}
          onPress={() => setMuted(p.conversation, !p.muted).then(done, fail)}
        />
      ) : null}
      {problem ? (
        <Txt
          size={13}
          color={c.accentText}
          style={{ marginTop: 14 }}
          accessibilityLiveRegion="polite"
        >
          {t('chat.err.offline')}
        </Txt>
      ) : null}
    </View>
  );
}
