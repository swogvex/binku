// First launch, < 1 min: 3 skippable intros → welcome (Crear cuenta / Iniciar sesión, small
// "Explorar sin cuenta"), then:
//   sign-up: country + region → date of birth (age gate) → account → groups + bias → binder ready
//   sign-in: account → done (the account's binders come down). An email with no profile yet
//            goes through country → date of birth first, like a sign-up.
//   explore: country + region → date of birth → groups + bias → binder ready (local only)
// The DOB comes before the account, so an under-age user never creates one; nothing is stored
// before that step. No OS permission is asked here.
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createBinder } from '@/data/binders';
import { getDb, setKv } from '@/data/db';
import { countryRules, saveLocalProfile, saveOnboarding } from '@/data/profile';
import geo from '@/content/geo/subdivisions.json';
import { useAccountFlow, type AccountResult } from '@/features/auth/useAccountFlow';
import { selectBinder } from '@/features/binder/useBinder';
import { useCatalogData } from '@/features/catalog/useCatalog';
import { fold } from '@/features/catalog/filter';
import { ageOn, fromDate, isoDate, type Dob } from '@/features/onboarding/age';
import { locale, t, type TKey } from '@/i18n';
import { textOn } from '@/lib/contrast';
import { era, fonts, radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { BinkuMark } from '@/ui/BinkuMark';
import { RoundButton } from '@/ui/RoundButton';
import { Button } from '@/ui/Button';
import { CardMarker } from '@/ui/CardMarker';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/icons/Icon';
import { Pocket } from '@/ui/Pocket';
import { StateView } from '@/ui/StateView';
import { Txt } from '@/ui/Txt';

type Country = keyof typeof geo;
type Step =
  'intro0' | 'intro1' | 'intro2' | 'welcome' | 'place' | 'dob' | 'blocked' | 'account' | 'groups';
type Mode = 'signup' | 'login' | 'explore';
const INTROS = ['collect', 'mark', 'match'] as const;
const COUNTRIES = Object.keys(geo) as Country[];
const formatDate = (d: Date) =>
  d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

const deviceCountry = (): Country => {
  const region = getLocales()[0]?.regionCode as Country | undefined;
  return region && region in geo ? region : 'ES';
};

function Circle({ children }: { children: ReactNode }) {
  const c = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        alignSelf: 'center',
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: c.surface2,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 12,
      }}
    >
      {children}
    </View>
  );
}

function IntroArt({ kind }: { kind: (typeof INTROS)[number] }) {
  const c = useTheme();
  if (kind === 'collect')
    return (
      <Circle>
        <View style={{ transform: [{ rotate: '-6deg' }] }}>
          <CardMarker
            member="Hana"
            album="Paper Moon"
            version="Ver. A"
            format="album"
            eraColor="tomato"
            width={96}
          />
        </View>
        <View style={{ transform: [{ rotate: '5deg' }] }}>
          <Pocket member="Yuri" width={96} />
        </View>
      </Circle>
    );
  if (kind === 'mark')
    return (
      <Circle>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <CardMarker
            member="Mina"
            album="Paper Moon"
            version="POB"
            format="pob"
            eraColor="cobalt"
            state={{ kind: 'want' }}
            width={110}
          />
          <View
            style={{
              flexDirection: 'row',
              gap: 4,
              padding: 4,
              borderRadius: radius.control,
              backgroundColor: c.surface,
            }}
          >
            {(['have', 'want', 'dupe'] as const).map((s) => (
              <View
                key={s}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: s === 'want' ? c.ink : 'transparent',
                }}
              >
                <Txt variant="label" size={12} color={s === 'want' ? c.onInk : c.ink}>
                  {s === 'dupe' ? t('cardSheet.dupe') : t(`card.${s}`)}
                </Txt>
              </View>
            ))}
          </View>
        </View>
      </Circle>
    );
  return (
    <Circle>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <CardMarker
          member="Jiwan"
          album="Paper Moon"
          version="Ver. B"
          format="album"
          eraColor="mint"
          width={84}
        />
        <Txt variant="label" size={12} muted>
          {t('onboarding.intro.youWant')}
        </Txt>
      </View>
      <Icon name="swap" size={24} />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <CardMarker
          member="Seora"
          album="Paper Moon"
          version="LD"
          format="luckyDraw"
          eraColor="bubblegum"
          width={84}
        />
        <Txt variant="label" size={12} muted>
          {t('onboarding.intro.youHave')}
        </Txt>
      </View>
    </Circle>
  );
}

/** Welcome art: the app-icon tile over a fan of tilted photocards (fictional members). */
function WelcomeArt() {
  const c = useTheme();
  const fan = [
    {
      member: 'Seora',
      version: 'POB',
      format: 'pob',
      eraColor: 'cobalt',
      x: -92,
      rotate: '-14deg',
    },
    {
      member: 'Jiwan',
      version: 'Ver. B',
      format: 'album',
      eraColor: 'mint',
      x: 92,
      rotate: '12deg',
    },
  ] as const;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 300, height: 230, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          position: 'absolute',
          width: 230,
          height: 230,
          borderRadius: 115,
          backgroundColor: c.surface2,
        }}
      />
      {fan.map((f) => (
        <View
          key={f.member}
          style={{
            position: 'absolute',
            transform: [{ translateX: f.x }, { translateY: 12 }, { rotate: f.rotate }],
          }}
        >
          <CardMarker
            member={f.member}
            album="Paper Moon"
            version={f.version}
            format={f.format}
            eraColor={f.eraColor}
            width={92}
          />
        </View>
      ))}
      {/* Same look as the app icon: tomato tile, ink pockets. */}
      <View
        style={{
          width: 108,
          height: 108,
          borderRadius: 28,
          backgroundColor: era.tomato,
          borderWidth: 4,
          borderColor: c.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BinkuMark size={80} wordmark={false} />
      </View>
    </View>
  );
}

export default function Onboarding() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cards } = useCatalogData();
  const [startedAt] = useState(() => Date.now());
  const [step, setStep] = useState<Step>('intro0');
  const [country, setCountry] = useState<Country>(deviceCountry);
  const [subdivision, setSubdivision] = useState<string>();
  const [regionQuery, setRegionQuery] = useState('');
  const [dobDate, setDobDate] = useState<Date>();
  const [dob, setDob] = useState<Dob>();
  const [groupQuery, setGroupQuery] = useState('');
  const [groups, setGroups] = useState<string[]>([]);
  const [bias, setBias] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Mode>('signup');
  // Set once the account exists: from then on there is no way back to the account steps.
  const [account, setAccount] = useState<AccountResult>();

  const rules = countryRules(getDb(), country);

  /** Returning user: their profile and binders are on the account, the onboarding is done. */
  const completeLogin = ({ profile }: AccountResult) => {
    saveOnboarding(getDb(), {
      country: profile.country,
      subdivision: profile.subdivision ?? '',
      isMinor: profile.is_minor,
      groups: [],
      bias: {},
    });
    router.replace('/binder');
  };

  const flow = useAccountFlow({
    start: 'email',
    intent: mode === 'login' ? 'signIn' : 'signUp',
    onDone: (r) => {
      setAccount(r);
      if (r.existing) completeLogin(r);
      else setStep('groups');
    },
    // "Iniciar sesión" with an email that has no account yet: ask country + DOB, then resume.
    onNeedsProfile: () => setStep('place'),
  });

  const prevStep: Partial<Record<Step, Step>> = {
    intro1: 'intro0',
    intro2: 'intro1',
    welcome: 'intro2',
    place: 'welcome',
    dob: 'place',
    blocked: 'dob',
    account: mode === 'login' ? 'welcome' : 'dob',
    groups: account ? undefined : 'dob',
  };
  const back = () => {
    if (step === 'account' && flow.back()) return true;
    const prev = prevStep[step];
    if (prev) setStep(prev);
    return !!prev;
  };
  const next = () =>
    setStep(step === 'intro0' ? 'intro1' : step === 'intro1' ? 'intro2' : 'welcome');
  const start = (m: Mode) => {
    setMode(m);
    setStep(m === 'login' ? 'account' : 'place');
  };

  // Android back walks the steps instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  });

  const allGroups = [
    ...new Map(
      cards.map((x) => [
        x.groupId,
        { id: x.groupId, name: x.groupName, monogram: x.groupMonogram, color: x.groupColor },
      ]),
    ).values(),
  ];

  const finish = (withBinder: boolean) => {
    const db = getDb();
    saveOnboarding(db, {
      country,
      subdivision: subdivision!,
      // With an account the DOB lives only on the server (already uploaded and deleted here).
      dob: account ? undefined : isoDate(dob!),
      isMinor: ageOn(dob!) < rules.minorLimit,
      groups,
      bias,
    });
    if (withBinder) {
      // First group, latest era (catalog rows come newest-first per group).
      const first = cards.find((x) => x.groupId === groups[0])!;
      const id = createBinder(db, {
        title: `${first.groupName} ${first.releaseTitle}`,
        kind: 'era',
        filter: { group: first.groupId, release: first.releaseId },
      });
      selectBinder(id);
      setKv(db, 'binder:hint', String(Math.round((Date.now() - startedAt) / 1000)));
      router.replace('/binder');
    } else {
      router.replace('/catalog');
    }
  };

  const subdivisions = geo[country].subdivisions.filter((s) =>
    fold(s.name).includes(fold(regionQuery.trim())),
  );
  const term = t(`onboarding.place.term.${geo[country].term}` as TKey);

  const isIntro = step.startsWith('intro');
  const intro = INTROS[Number(step.slice(5))];

  let body: ReactNode;
  let action: ReactNode;
  if (isIntro) {
    body = (
      <View style={{ gap: 24, paddingTop: 12 }}>
        <IntroArt kind={intro} />
        <Txt variant="display" size={46} accessibilityRole="header">
          {t(`onboarding.intro.${intro}.title`)}
        </Txt>
        <Txt size={17} muted>
          {t(`onboarding.intro.${intro}.body`)}
        </Txt>
      </View>
    );
    action = <Button label={t('onboarding.next')} onPress={next} />;
  } else if (step === 'place') {
    body = (
      <View style={{ gap: 16 }}>
        <Txt variant="display" size={40} accessibilityRole="header">
          {t('onboarding.place.title')}
        </Txt>
        <Txt muted>{t('onboarding.place.body', { term })}</Txt>
        <Txt variant="label">{t('onboarding.place.country')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {COUNTRIES.map((code) => (
            <Chip
              key={code}
              label={t(`onboarding.place.countries.${code}`)}
              selected={code === country}
              onPress={() => {
                setCountry(code);
                setSubdivision(undefined);
              }}
            />
          ))}
        </View>
        <Txt variant="label" style={{ textTransform: 'capitalize' }}>
          {term}
        </Txt>
        <TextInput
          value={regionQuery}
          onChangeText={setRegionQuery}
          placeholder={t('onboarding.place.search')}
          placeholderTextColor={c.muted}
          accessibilityLabel={`${t('onboarding.place.search')} ${term}`}
          style={{
            height: 50,
            borderRadius: radius.control,
            borderWidth: 1.5,
            borderColor: c.line,
            backgroundColor: c.surface,
            paddingHorizontal: 14,
            fontFamily: fonts.text400,
            fontSize: 15,
            color: c.ink,
          }}
        />
        <View
          style={{
            borderRadius: radius.card,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
          }}
        >
          {subdivisions.map((s, i) => {
            const selected = s.code === subdivision;
            return (
              <Pressable
                key={s.code}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setSubdivision(s.code)}
                style={{
                  minHeight: 48,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: c.line,
                }}
              >
                <Txt variant={selected ? 'title' : 'body'} size={15} style={{ flex: 1 }}>
                  {s.name}
                </Txt>
                {selected ? <Icon name="check" size={20} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
    action = (
      <Button
        label={t('onboarding.continue')}
        disabled={!subdivision}
        onPress={() => setStep('dob')}
      />
    );
  } else if (step === 'dob') {
    const value = dobDate ?? new Date(new Date().getFullYear() - 16, 0, 1);
    const pick = (_: unknown, d?: Date) => d && setDobDate(d);
    body = (
      <View style={{ gap: 16 }}>
        <Txt variant="display" size={40} accessibilityRole="header">
          {t('onboarding.dob.title')}
        </Txt>
        <Txt muted>{t('onboarding.dob.body')}</Txt>
        {Platform.OS === 'ios' ? (
          // iOS: wheel, as in the approved canvas.
          <DateTimePicker
            value={value}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            onChange={pick}
            locale={locale}
          />
        ) : (
          // Android: field that opens the Material calendar dialog.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.dob.title')}
            accessibilityValue={{ text: dobDate ? formatDate(dobDate) : t('onboarding.dob.pick') }}
            onPress={() =>
              DateTimePickerAndroid.open({
                value,
                mode: 'date',
                maximumDate: new Date(),
                onChange: pick,
              })
            }
            style={{
              height: 50,
              borderRadius: radius.control,
              borderWidth: 1.5,
              borderColor: c.line,
              backgroundColor: c.surface,
              paddingHorizontal: 14,
              justifyContent: 'center',
            }}
          >
            <Txt size={17} muted={!dobDate}>
              {dobDate ? formatDate(dobDate) : t('onboarding.dob.pick')}
            </Txt>
          </Pressable>
        )}
        <Txt size={13} muted>
          {t('onboarding.dob.min', { age: rules.minAge })}
        </Txt>
      </View>
    );
    action = (
      <Button
        label={t('onboarding.continue')}
        // Must be picked on both platforms: the iOS wheel's default would let anyone through.
        disabled={!dobDate}
        onPress={() => {
          const parsed = fromDate(value);
          setDob(parsed);
          if (ageOn(parsed) < rules.minAge) return setStep('blocked');
          if (mode === 'explore') return setStep('groups');
          // The account step creates the profile from these answers (DOB deleted right after).
          saveLocalProfile(getDb(), {
            country,
            subdivision: subdivision!,
            dob: isoDate(parsed),
            isMinor: ageOn(parsed) < rules.minorLimit,
            groups: [],
            bias: {},
          });
          setStep('account');
          // Already signed in ("Iniciar sesión" with a new email): carry on creating the profile.
          if (mode === 'login') flow.resume();
        }}
      />
    );
  } else if (step === 'welcome') {
    body = (
      <View style={{ alignItems: 'center', gap: 28 }}>
        <WelcomeArt />
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Txt variant="display" size={46} accessibilityRole="header" style={{ letterSpacing: 2 }}>
            Binku
          </Txt>
          <Txt size={17} muted style={{ textAlign: 'center', maxWidth: 320 }}>
            {t('onboarding.welcome.body')}
          </Txt>
        </View>
      </View>
    );
    action = (
      <View style={{ gap: 6 }}>
        <Button label={t('onboarding.welcome.signUp')} onPress={() => start('signup')} />
        <Button
          variant="ghost"
          label={t('onboarding.welcome.signIn')}
          onPress={() => start('login')}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => start('explore')}
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt variant="label" size={15} muted>
            {t('onboarding.welcome.explore')}
          </Txt>
        </Pressable>
        <Txt size={12} muted style={{ textAlign: 'center' }}>
          {t('onboarding.welcome.unofficial')}
        </Txt>
      </View>
    );
  } else if (step === 'account') {
    body = flow.body;
    action = flow.action;
  } else if (step === 'blocked') {
    body = (
      <StateView
        illustration="pocket"
        title={t('onboarding.blocked.title')}
        body={t('onboarding.blocked.body', { age: rules.minAge })}
      />
    );
    action = (
      <Button variant="ghost" label={t('onboarding.blocked.back')} onPress={() => setStep('dob')} />
    );
  } else {
    const q = groupQuery.trim().toLowerCase();
    body = (
      <View style={{ gap: 16 }}>
        <Txt variant="display" size={40} accessibilityRole="header">
          {t('onboarding.groups.title')}
        </Txt>
        <Txt muted>{t('onboarding.groups.body')}</Txt>
        <TextInput
          value={groupQuery}
          onChangeText={setGroupQuery}
          placeholder={t('onboarding.groups.search')}
          placeholderTextColor={c.muted}
          accessibilityLabel={t('onboarding.groups.search')}
          style={{
            height: 50,
            borderRadius: radius.control,
            borderWidth: 1.5,
            borderColor: c.line,
            backgroundColor: c.surface,
            paddingHorizontal: 14,
            fontFamily: fonts.text400,
            fontSize: 15,
            color: c.ink,
          }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {allGroups
            .filter((g) => fold(g.name).includes(fold(q)))
            .map((g) => {
              const selected = groups.includes(g.id);
              const bg = era[g.color];
              return (
                <Pressable
                  key={g.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={g.name}
                  onPress={() =>
                    setGroups((gs) => (selected ? gs.filter((x) => x !== g.id) : [...gs, g.id]))
                  }
                  style={{
                    width: '48%',
                    flexGrow: 1,
                    minHeight: 64,
                    padding: 10,
                    gap: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderRadius: radius.card,
                    borderWidth: 1.5,
                    borderColor: selected ? c.ink : c.line,
                    backgroundColor: c.surface,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Txt variant="display" size={17} color={textOn(bg)}>
                      {g.monogram}
                    </Txt>
                  </View>
                  <Txt variant="title" size={15} numberOfLines={2} style={{ flex: 1 }}>
                    {g.name}
                  </Txt>
                  {selected ? <Icon name="check" size={20} /> : null}
                </Pressable>
              );
            })}
        </View>
        {groups.map((gid) => {
          const name = allGroups.find((g) => g.id === gid)?.name ?? '';
          const members = [
            ...new Map(
              cards.filter((x) => x.groupId === gid).map((x) => [x.memberId, x.memberName]),
            ),
          ];
          const chosen = bias[gid] ?? 'all';
          return (
            <View key={gid} style={{ gap: 8 }}>
              <Txt variant="label">{t('onboarding.groups.bias', { group: name })}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[...members, ['all', t('onboarding.groups.all')] as const].map(([id, label]) => (
                  <Chip
                    key={id}
                    label={label}
                    selected={chosen === id}
                    onPress={() => setBias((b) => ({ ...b, [gid]: id }))}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    );
    action = (
      <View style={{ gap: 6 }}>
        <Button
          label={t('onboarding.groups.create')}
          disabled={!groups.length}
          onPress={() => finish(true)}
        />
        <Button variant="ghost" label={t('onboarding.groups.skip')} onPress={() => finish(false)} />
      </View>
    );
  }

  return (
    // Keeps the action button above the keyboard (date and search fields).
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8 }}
    >
      {step === 'welcome' ? null : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: screenPadding,
            minHeight: 48,
          }}
        >
          {/* iOS has no system back: every step after the intros gets one on screen. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {!isIntro && prevStep[step] ? (
              <RoundButton icon="chevronLeft" label={t('onboarding.back')} onPress={back} />
            ) : null}
            <BinkuMark />
          </View>
          {isIntro ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setStep('welcome')}
              hitSlop={12}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Txt variant="label" size={15} muted>
                {t('onboarding.skip')}
              </Txt>
            </Pressable>
          ) : null}
        </View>
      )}
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          { padding: screenPadding, paddingBottom: 24 },
          // The welcome is the app's cover: centred, no header.
          step === 'welcome' && { flexGrow: 1, justifyContent: 'center' },
        ]}
      >
        {body}
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
