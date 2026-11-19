// Settings (canvas "iPhone · Ajustes"), M3 subset: account card, PREFERENCIAS (language),
// TUS DATOS (export, delete), sign out. Preferences, privacy and "Sobre la app" rows arrive with their features (M5–M8).
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDb } from '@/data/db';
import { deleteAccount, signOut } from '@/data/sync';
import { exportCsv, exportJson } from '@/features/account/exportData';
import { authErrorKey, fetchProfile } from '@/features/auth/account';
import { useSession } from '@/features/auth/useSession';
import { locale, t } from '@/i18n';
import { fonts, radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { Icon, type IconName } from '@/ui/icons/Icon';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';

/** "luna@•••.com": enough to recognise it, not to read it over a shoulder. */
const maskEmail = (email = '') => {
  const [user, domain = ''] = email.split('@');
  return `${user}@•••${domain.slice(domain.lastIndexOf('.'))}`;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Txt
        variant="label"
        size={12}
        muted
        accessibilityRole="header"
        style={{ letterSpacing: 1, paddingLeft: 4, textTransform: 'uppercase' }}
      >
        {title}
      </Txt>
      <View
        style={{
          borderRadius: radius.card,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.line,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Row(props: {
  icon: IconName;
  label: string;
  value?: string;
  danger?: boolean;
  first?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  const color = props.danger ? c.accentText : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 50,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderTopWidth: props.first ? 0 : 1,
        borderTopColor: c.line,
        backgroundColor: pressed ? c.surface2 : 'transparent',
        opacity: props.disabled ? 0.5 : 1,
      })}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={props.icon} size={17} color={color} />
      </View>
      <Txt size={15} color={color} style={{ flex: 1, fontFamily: fonts.text500 }}>
        {props.label}
      </Txt>
      {props.value ? (
        <Txt size={13} muted>
          {props.value}
        </Txt>
      ) : null}
      <Icon name="chevronRight" size={16} color={c.muted} />
    </Pressable>
  );
}

export default function Settings() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const [username, setUsername] = useState<string | null>();
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      fetchProfile()
        .then((data) => setUsername(data?.username ?? null))
        .catch(() => {}); // offline: keep what is shown
    }, [session]),
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert(t(authErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const onExport = () =>
    Alert.alert(t('settings.export.title'), t('settings.export.body'), [
      { text: t('settings.export.json'), onPress: () => run(exportJson) },
      { text: t('settings.export.csv'), onPress: () => run(() => exportCsv(getDb())) },
      { text: t('settings.cancel'), style: 'cancel' },
    ]);

  const onDelete = () =>
    Alert.alert(t('settings.delete.confirmTitle'), t('settings.delete.confirmBody'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.delete.confirm'),
        style: 'destructive',
        onPress: () =>
          run(async () => {
            const until = await deleteAccount();
            // The onboarding takes over the screen (no local data left); the alert stays on top.
            Alert.alert(
              t('settings.delete.doneTitle'),
              t('settings.delete.doneBody', {
                date: new Date(until).toLocaleDateString(locale, {
                  day: 'numeric',
                  month: 'long',
                }),
              }),
            );
          }),
      },
    ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingHorizontal: screenPadding,
        paddingBottom: insets.bottom + 32,
        gap: 18,
      }}
    >
      <RoundButton icon="chevronLeft" label={t('auth.close')} onPress={() => router.back()} />
      <Txt variant="display" size={40} accessibilityRole="header">
        {t('settings.title')}
      </Txt>

      {session ? (
        <View
          accessible
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: radius.control,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: c.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt variant="display" size={22} color={c.onInk}>
              {(username ?? session.user.email ?? '?')[0]}
            </Txt>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="title" size={17}>
              {username ? `@${username}` : t('settings.account')}
            </Txt>
            <Txt size={13} muted>
              {`${maskEmail(session.user.email)} · ${t('settings.provider.email')}`}
            </Txt>
          </View>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Txt muted>{t('auth.email.body')}</Txt>
          <View style={{ gap: 10 }}>
            <Button label={t('auth.profile.signUp')} onPress={() => router.push('/sign-in')} />
            <Button
              variant="ghost"
              label={t('auth.profile.signIn')}
              onPress={() => router.push({ pathname: '/sign-in', params: { intent: 'signIn' } })}
            />
          </View>
        </View>
      )}

      <Section title={t('settings.preferences')}>
        {/* Per-app language lives in the OS (iOS app settings, Android 13+ App info). */}
        <Row
          first
          icon="language"
          label={t('settings.language')}
          value={t('settings.languageName')}
          onPress={() => Linking.openSettings()}
        />
      </Section>

      {session ? (
        <Section title={t('settings.data')}>
          <Row
            first
            icon="export"
            label={t('settings.export.title')}
            value="JSON · CSV"
            disabled={busy}
            onPress={onExport}
          />
          <Row
            icon="close"
            label={t('settings.delete.title')}
            danger
            disabled={busy}
            onPress={onDelete}
          />
        </Section>
      ) : null}

      {session ? (
        <Button
          variant="ghost"
          label={t('auth.profile.signOut')}
          disabled={busy}
          onPress={() => run(async () => void (await signOut()))}
        />
      ) : null}

      <Txt size={12} muted style={{ textAlign: 'center' }}>
        {`Binku ${Constants.expoConfig?.version ?? ''} · ${t('onboarding.welcome.unofficial')}`}
      </Txt>
    </ScrollView>
  );
}
