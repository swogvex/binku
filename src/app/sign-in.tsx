// Account (canvas "Flujo · Cuenta"): email → 6-digit code (no passwords) → first time: profile
// from the local onboarding (DOB uploaded, then deleted on the device) → pick @username.
// `?resume=1` finishes an account whose set-up was interrupted (offline, app closed).
// Apple / Google buttons and the Turnstile check come later in this milestone.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDb } from '@/data/db';
import {
  authErrorKey,
  ensureProfile,
  saveUsername,
  suggestUsername,
  USERNAME,
} from '@/features/auth/account';
import { locale, t, type TKey } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { fonts, radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { BinkuMark } from '@/ui/BinkuMark';
import { Button } from '@/ui/Button';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';

type Step = 'email' | 'code' | 'finish' | 'username';
const CODE_LENGTH = 6;
const RESEND_SECONDS = 60; // matches auth.email.max_frequency in supabase/config.toml
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function useInputStyle() {
  const c = useTheme();
  return {
    height: 50,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    fontFamily: fonts.text400,
    fontSize: 17,
    color: c.ink,
  } as const;
}

/** Six boxes drawn over one real (transparent) input: paste and OS code autofill keep working. */
function CodeInput(props: { value: string; onChange: (v: string) => void }) {
  const c = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 60,
              borderRadius: radius.control,
              borderWidth: 1.5,
              borderColor: i === props.value.length ? c.ink : c.line,
              backgroundColor: c.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt variant="display" size={34}>
              {props.value[i] ?? ''}
            </Txt>
          </View>
        ))}
      </View>
      <TextInput
        value={props.value}
        onChangeText={(v) => props.onChange(v.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        maxLength={CODE_LENGTH}
        caretHidden
        accessibilityLabel={t('auth.code.label')}
        style={{ position: 'absolute', inset: 0, color: 'transparent', opacity: 0.02 }}
      />
    </View>
  );
}

export default function SignIn() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputStyle = useInputStyle();
  const { resume } = useLocalSearchParams<{ resume?: string }>();
  const [step, setStep] = useState<Step>(resume ? 'finish' : 'email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TKey>();
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(authErrorKey(e));
    } finally {
      setBusy(false);
    }
  };

  const finishProfile = async () => {
    if (await ensureProfile(getDb())) return router.back();
    setUsername(suggestUsername(getDb()));
    setStep('username');
  };
  const finish = () => run(finishProfile);

  const sendCode = () =>
    run(async () => {
      const { error: e } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        // `locale` picks the language of the code email (template in supabase/templates).
        options: { shouldCreateUser: true, data: { locale } },
      });
      if (e) throw e;
      setCode('');
      setWait(RESEND_SECONDS);
      setStep('code');
    });

  const verify = (token: string) =>
    run(async () => {
      const { error: e } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'email',
      });
      if (e) {
        setCode('');
        throw e;
      }
      // Signed in from here: a failure below leaves the "finish" step with a retry.
      setStep('finish');
      await finishProfile();
    });

  const resumeRan = useRef(false);
  useEffect(() => {
    if (resume && !resumeRan.current) {
      resumeRan.current = true;
      finish();
    }
  });

  const onCode = (v: string) => {
    setCode(v);
    if (v.length === CODE_LENGTH && !busy) verify(v);
  };

  let body: ReactNode;
  let action: ReactNode;
  if (step === 'email') {
    const valid = EMAIL.test(email.trim());
    body = (
      <View style={{ gap: 16 }}>
        <Txt variant="display" size={40} accessibilityRole="header">
          {t('auth.email.title')}
        </Txt>
        <Txt muted>{t('auth.email.body')}</Txt>
        <Txt variant="label">{t('auth.email.label')}</Txt>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.email.placeholder')}
          placeholderTextColor={c.muted}
          accessibilityLabel={t('auth.email.label')}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="send"
          onSubmitEditing={() => valid && sendCode()}
          style={inputStyle}
        />
        <Txt size={13} muted>
          {t('auth.email.legal')}
        </Txt>
      </View>
    );
    action = <Button label={t('auth.email.send')} disabled={!valid || busy} onPress={sendCode} />;
  } else if (step === 'code') {
    body = (
      <View style={{ gap: 16 }}>
        <Txt variant="display" size={40} accessibilityRole="header">
          {t('auth.code.title')}
        </Txt>
        <Txt muted>{t('auth.code.body', { email: email.trim() })}</Txt>
        <CodeInput value={code} onChange={onCode} />
        <Txt size={13} muted>
          {t('auth.code.help')}
        </Txt>
      </View>
    );
    action = (
      <View style={{ gap: 6 }}>
        <Button
          variant="ghost"
          label={
            wait > 0
              ? t('auth.code.resendIn', { time: `0:${String(wait).padStart(2, '0')}` })
              : t('auth.code.resend')
          }
          disabled={wait > 0 || busy}
          onPress={sendCode}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setStep('email')}
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt variant="label" size={15} muted>
            {t('auth.code.change')}
          </Txt>
        </Pressable>
      </View>
    );
  } else if (step === 'finish') {
    body = (
      <View style={{ gap: 16 }}>
        <Txt variant="display" size={40} accessibilityRole="header">
          {t('auth.finish.title')}
        </Txt>
      </View>
    );
    action = error ? (
      <Button label={t('auth.finish.retry')} disabled={busy} onPress={finish} />
    ) : null;
  } else {
    const valid = USERNAME.test(username);
    body = (
      <View style={{ gap: 16 }}>
        <Txt variant="display" size={40} accessibilityRole="header">
          {t('auth.username.title')}
        </Txt>
        <Txt muted>{t('auth.username.body')}</Txt>
        <View style={{ justifyContent: 'center' }}>
          <TextInput
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase().trim())}
            accessibilityLabel={t('auth.username.label')}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
            maxLength={20}
            style={[inputStyle, { paddingLeft: 34 }]}
          />
          <Txt
            size={17}
            muted
            style={{ position: 'absolute', left: 16 }}
            importantForAccessibility="no"
          >
            @
          </Txt>
        </View>
        <Txt size={13} muted>
          {t('auth.username.rules')}
        </Txt>
      </View>
    );
    action = (
      <Button
        label={t('auth.username.save')}
        disabled={!valid || busy}
        onPress={() =>
          run(async () => {
            await saveUsername(username);
            router.back();
          })
        }
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: screenPadding,
          minHeight: 48,
        }}
      >
        <RoundButton icon="chevronLeft" label={t('auth.close')} onPress={() => router.back()} />
        <BinkuMark />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: screenPadding, paddingBottom: 24, gap: 16 }}
      >
        {body}
        {error ? (
          <Txt color={c.accentText} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {t(error)}
          </Txt>
        ) : null}
      </ScrollView>
      <View
        style={{
          paddingHorizontal: screenPadding,
          paddingBottom: insets.bottom + 12,
          paddingTop: 8,
        }}
      >
        {action}
      </View>
    </KeyboardAvoidingView>
  );
}
