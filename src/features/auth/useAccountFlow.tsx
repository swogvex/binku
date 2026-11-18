// Account steps (canvas "Flujo · Cuenta"), shared by the onboarding and the `sign-in` screen:
// email → 6-digit code (no passwords) → profile (created from the local onboarding answers, DOB
// then deleted on the device) → pick @username → "Subir a mi cuenta" / "Empezar de cero" when
// this phone has a binder made without account. Returns body + action for the host's layout.
// Apple / Google buttons and the Turnstile check come later in M3.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { getDb, getKv } from '@/data/db';
import { getLocalProfile, forgetDob } from '@/data/profile';
import { linkAccount, localSummary } from '@/data/sync';
import {
  authErrorKey,
  cancelDeletion,
  createProfile,
  fetchProfile,
  saveUsername,
  suggestUsername,
  USERNAME,
  type ServerProfile,
} from '@/features/auth/account';
import { locale, t, type TKey } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { fonts, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { Txt } from '@/ui/Txt';

type Step = 'email' | 'code' | 'finish' | 'username' | 'upload';
const CODE_LENGTH = 6;
const RESEND_SECONDS = 60; // matches auth.email.max_frequency in supabase/config.toml
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AccountResult = {
  /** The account already had a profile before this sign-in (a returning user). */
  existing: boolean;
  profile: ServerProfile;
};

type Options = {
  /** `finish` resumes an account that is signed in but not set up (offline, app closed). */
  start: 'email' | 'finish';
  /** Copy of the email step: creating an account or coming back to one. */
  intent?: 'signUp' | 'signIn';
  /** Signed in, profile + @username ready and this phone linked to the account. */
  onDone: (r: AccountResult) => void;
  /** New account but no local country + DOB yet (chose "Iniciar sesión" first): ask them, then `resume()`. */
  onNeedsProfile?: () => void;
};

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

export function useAccountFlow({ start, intent = 'signUp', onDone, onNeedsProfile }: Options) {
  const c = useTheme();
  const inputStyle = useInputStyle();
  const [step, setStep] = useState<Step>(start);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TKey>();
  const [wait, setWait] = useState(0);
  const [summary, setSummary] = useState({ binders: 0, cards: 0 });
  const result = useRef<AccountResult>(undefined);

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

  const userId = async () => (await supabase.auth.getSession()).data.session!.user.id;
  const done = () => onDone(result.current!);

  /** Links this phone's data to the account, asking first if there is a local binder. */
  const linkOrAsk = async () => {
    const db = getDb();
    const uid = await userId();
    if (getKv(db, 'sync:user') === uid) return done();
    const s = localSummary(db);
    if (s.binders || s.cards) {
      setSummary(s);
      setStep('upload');
      return;
    }
    await linkAccount(db, uid, 'fresh');
    done();
  };

  const finishProfile = async () => {
    const db = getDb();
    let profile = await fetchProfile();
    const existing = !!profile;
    if (!profile) {
      if (!getLocalProfile(db)?.dob) {
        if (onNeedsProfile) return onNeedsProfile();
        throw new Error('No local date of birth to create the profile');
      }
      profile = await createProfile(db);
    }
    if (profile.deletion_requested_at) {
      await cancelDeletion();
      profile.deletion_requested_at = null;
      Alert.alert(t('settings.delete.cancelledTitle'), t('settings.delete.cancelledBody'));
    }
    forgetDob(db); // returning users too: the account already holds it
    result.current = { existing, profile };
    if (!profile.username) {
      setUsername(suggestUsername(db));
      setStep('username');
      return;
    }
    setUsername(profile.username);
    await linkOrAsk();
  };
  const resume = () => {
    setStep('finish');
    return run(finishProfile);
  };

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
    if (start === 'finish' && !resumeRan.current) {
      resumeRan.current = true;
      resume();
    }
  });

  const onCode = (v: string) => {
    setCode(v);
    if (v.length === CODE_LENGTH && !busy) verify(v);
  };

  /** Walks back inside the flow; false when the host should handle it. */
  const back = () => {
    if (step !== 'code') return false;
    setStep('email');
    return true;
  };

  let body: ReactNode;
  let action: ReactNode;
  if (step === 'email') {
    const valid = EMAIL.test(email.trim());
    body = (
      <View style={{ gap: 16 }}>
        <Txt variant="display" size={40} accessibilityRole="header">
          {t(intent === 'signIn' ? 'auth.email.signInTitle' : 'auth.email.title')}
        </Txt>
        <Txt muted>{t(intent === 'signIn' ? 'auth.email.signInBody' : 'auth.email.body')}</Txt>
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
          onSubmitEditing={() => valid && !busy && sendCode()}
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
      <Txt variant="display" size={40} accessibilityRole="header">
        {t('auth.finish.title')}
      </Txt>
    );
    action = error ? (
      <Button label={t('auth.finish.retry')} disabled={busy} onPress={resume} />
    ) : null;
  } else if (step === 'upload') {
    const link = (mode: 'upload' | 'fresh') =>
      run(async () => {
        await linkAccount(getDb(), await userId(), mode);
        done();
      });
    body = (
      <View style={{ gap: 16 }}>
        <Txt variant="display" size={40} accessibilityRole="header">
          {t('auth.upload.title', { username })}
        </Txt>
        <Txt muted>{t('auth.upload.body')}</Txt>
        <Txt variant="title">
          {`${t('auth.upload.binders', { count: summary.binders })} · ${t('auth.upload.cards', { count: summary.cards })}`}
        </Txt>
      </View>
    );
    action = (
      <View style={{ gap: 6 }}>
        <Button label={t('auth.upload.keep')} disabled={busy} onPress={() => link('upload')} />
        <Button
          variant="ghost"
          label={t('auth.upload.fresh')}
          disabled={busy}
          onPress={() => link('fresh')}
        />
      </View>
    );
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
            result.current!.profile.username = username;
            await linkOrAsk();
          })
        }
      />
    );
  }

  body = (
    <View style={{ gap: 16 }}>
      {body}
      {error ? (
        <Txt color={c.accentText} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {t(error)}
        </Txt>
      ) : null}
    </View>
  );

  return { body, action, back, resume };
}
