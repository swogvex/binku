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
import { haptics } from '@/lib/haptics';
import { cardRadius, cardRatio, era, radius, screenPadding, type Era } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { BinkuMark } from '@/ui/BinkuMark';
import { RoundButton } from '@/ui/RoundButton';
import { Button } from '@/ui/Button';
import { CardMarker } from '@/ui/CardMarker';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/icons/Icon';
import { SearchField } from '@/ui/SearchField';
import { StateView } from '@/ui/StateView';
import { StepHeader } from '@/ui/StepHeader';
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

/**
 * A binder page in the logo's motif: 3×3 pockets, some filled with era colours. The empty
 * middle-right pocket (the logo's filled one) is outlined in ink: the card on top goes there.
 */
function BinderPage() {
  const c = useTheme();
  const fill: (Era | null)[] = [
    'cobalt',
    null,
    'mint',
    null,
    'bubblegum',
    null,
    'mango',
    null,
    'cobalt',
  ];
  const pocket = { width: 40, aspectRatio: cardRatio, borderRadius: cardRadius(40) };
  return (
    <View
      style={{
        width: 158,
        padding: 12,
        gap: 7,
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderRadius: 18,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      {fill.map((e, i) =>
        e ? (
          <View key={i} style={[pocket, { backgroundColor: era[e] }]} />
        ) : (
          <View
            key={i}
            style={[
              pocket,
              {
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: i === 5 ? c.ink : c.muted,
                backgroundColor: c.surface2,
              },
            ]}
          />
        ),
      )}
    </View>
  );
}

/** Have / Want / Dupe as the card sheet shows them (canvas segmented control). */
function MarkSwitch() {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 4,
        padding: 4,
        borderRadius: radius.control,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      {(['have', 'want', 'dupe'] as const).map((s) => (
        <View
          key={s}
          style={{
            paddingHorizontal: 12,
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
  );
}

function IntroArt({ kind }: { kind: (typeof INTROS)[number] }) {
  const c = useTheme();
  if (kind === 'collect')
    return (
      <Circle>
        <View style={{ transform: [{ translateX: -26 }, { rotate: '-5deg' }] }}>
          <BinderPage />
        </View>
        <View
          style={{
            position: 'absolute',
            transform: [{ translateX: 62 }, { translateY: 6 }, { rotate: '11deg' }],
          }}
        >
          <CardMarker
            member="Hana"
            album="Paper Moon"
            version="Ver. A"
            format="album"
            eraColor="tomato"
            width={88}
          />
        </View>
      </Circle>
    );
  if (kind === 'mark')
    return (
      <Circle>
        <View
          style={{
            position: 'absolute',
            transform: [{ translateX: -76 }, { translateY: -14 }, { rotate: '-12deg' }],
          }}
        >
          <CardMarker
            member="Hana"
            album="Paper Moon"
            version="Ver. A"
            format="album"
            eraColor="tomato"
            state={{ kind: 'have' }}
            width={80}
          />
        </View>
        <View
          style={{
            position: 'absolute',
            transform: [{ translateX: 76 }, { translateY: -14 }, { rotate: '12deg' }],
          }}
        >
          <CardMarker
            member="Jiwan"
            album="Paper Moon"
            version="Ver. B"
            format="album"
            eraColor="mint"
            state={{ kind: 'dupe', count: 2 }}
            width={80}
          />
        </View>
        <View style={{ position: 'absolute', transform: [{ translateY: -26 }] }}>
          <CardMarker
            member="Mina"
            album="Paper Moon"
            version="POB"
            format="pob"
            eraColor="cobalt"
            state={{ kind: 'want' }}
            width={96}
          />
        </View>
        <View style={{ position: 'absolute', bottom: 30 }}>
          <MarkSwitch />
        </View>
      </Circle>
    );
  return (
    <Circle>
      <View style={{ alignItems: 'center', gap: 6, transform: [{ rotate: '-5deg' }] }}>
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
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: c.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="swap" size={22} color={c.onInk} strokeWidth={2} />
      </View>
      <View style={{ alignItems: 'center', gap: 6, transform: [{ rotate: '5deg' }] }}>
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

/** Intro position: the current page is a short ink bar, the others small dots. */
function PageDots({ index, count }: { index: number; count: number }) {
  const c = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={t('onboarding.page', { n: index + 1, total: count })}
      style={{ flexDirection: 'row', gap: 6 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === index ? 22 : 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: i === index ? c.ink : c.line,
          }}
        />
      ))}
    </View>
  );
}

/** Set-up progress: one segment per step, filled up to the current one. */
function StepProgress({ index, count }: { index: number; count: number }) {
  const c = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('onboarding.step', { n: index + 1, total: count })}
      style={{ flexDirection: 'row', gap: 6 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: 28,
            height: 5,
            borderRadius: 3,
            backgroundColor: i <= index ? c.ink : c.line,
          }}
        />
      ))}
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Txt
      variant="label"
      size={12}
      muted
      accessibilityRole="header"
      style={{ letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}
    >
      {children}
    </Txt>
  );
}

function Radio({ selected }: { selected: boolean }) {
  const c = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: selected ? 0 : 1.5,
        borderColor: c.line,
        backgroundColor: selected ? c.ink : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? <Icon name="check" size={14} color={c.onInk} strokeWidth={2.4} /> : null}
    </View>
  );
}

type Group = { id: string; name: string; monogram: string; color: keyof typeof era };

function Monogram({ group, size }: { group: Group; size: number }) {
  const bg = era[group.color];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt variant="display" size={size >= 48 ? 22 : 13} color={textOn(bg)}>
        {group.monogram}
      </Txt>
    </View>
  );
}

/** Half-width group card: monogram on top, name below, ink outline + check when chosen. */
function GroupTile(props: { group: Group; selected: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.selected }}
      accessibilityLabel={props.group.name}
      onPress={() => {
        haptics.selection();
        props.onPress();
      }}
      style={({ pressed }) => ({
        width: '48.5%',
        // Fixed height keeps the grid aligned whatever the name length.
        height: 136,
        padding: 14,
        gap: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.card,
        borderWidth: props.selected ? 2 : 1.5,
        borderColor: props.selected ? c.ink : c.line,
        backgroundColor: pressed ? c.surface2 : c.surface,
      })}
    >
      <Monogram group={props.group} size={52} />
      {/* Long names (e.g. "TOMORROW X TOGETHER") wrap to two lines and shrink a little. */}
      <Txt
        variant="title"
        size={15}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{ textAlign: 'center', alignSelf: 'stretch' }}
      >
        {props.group.name}
      </Txt>
      {props.selected ? (
        <View style={{ position: 'absolute', top: 10, right: 10 }}>
          <Radio selected />
        </View>
      ) : null}
    </Pressable>
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
  // "Iniciar sesión" with an email that has no account yet: it continues as a sign-up.
  const [needsProfile, setNeedsProfile] = useState(false);

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
    onNeedsProfile: () => {
      setNeedsProfile(true);
      setStep('place');
    },
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

  // Set-up steps shown in the progress bar for each path ("Iniciar sesión" with an existing
  // account has no set-up at all, so no bar).
  const setupSteps: Step[] =
    mode === 'explore'
      ? ['place', 'dob', 'groups']
      : mode === 'signup'
        ? ['place', 'dob', 'account', 'groups']
        : needsProfile
          ? ['account', 'place', 'dob', 'groups']
          : [];
  const stepIndex = setupSteps.indexOf(step === 'blocked' ? 'dob' : step);

  const isIntro = step.startsWith('intro');
  const introIndex = Number(step.slice(5));
  const intro = INTROS[introIndex];

  let body: ReactNode;
  let action: ReactNode;
  if (isIntro) {
    body = (
      <View style={{ alignItems: 'center', gap: 28 }}>
        <IntroArt kind={intro} />
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Txt
            variant="display"
            size={46}
            accessibilityRole="header"
            style={{ textAlign: 'center' }}
          >
            {t(`onboarding.intro.${intro}.title`)}
          </Txt>
          <Txt size={17} muted style={{ textAlign: 'center', maxWidth: 320 }}>
            {t(`onboarding.intro.${intro}.body`)}
          </Txt>
        </View>
        <PageDots index={introIndex} count={INTROS.length} />
      </View>
    );
    action = <Button label={t('onboarding.next')} onPress={next} />;
  } else if (step === 'place') {
    body = (
      <View style={{ gap: 24 }}>
        <StepHeader
          icon="pin"
          tint="cobalt"
          title={t('onboarding.place.title')}
          body={t('onboarding.place.body', { term })}
        />
        <View style={{ gap: 10 }}>
          <FieldLabel>{t('onboarding.place.country')}</FieldLabel>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}
          >
            {COUNTRIES.map((code) => (
              <Chip
                key={code}
                label={t(`onboarding.place.countries.${code}`)}
                selected={code === country}
                onPress={() => {
                  setCountry(code);
                  setSubdivision(undefined);
                  setRegionQuery('');
                }}
              />
            ))}
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <FieldLabel>{term}</FieldLabel>
          <SearchField
            value={regionQuery}
            onChangeText={setRegionQuery}
            placeholder={t('onboarding.place.search')}
            accessibilityLabel={`${t('onboarding.place.search')} ${term}`}
          />
          <View
            style={{
              borderRadius: radius.card,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.line,
              overflow: 'hidden',
            }}
          >
            {subdivisions.map((s, i) => {
              const selected = s.code === subdivision;
              return (
                <Pressable
                  key={s.code}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    haptics.selection();
                    setSubdivision(s.code);
                  }}
                  style={({ pressed }) => ({
                    minHeight: 50,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: c.line,
                    backgroundColor: selected || pressed ? c.surface2 : 'transparent',
                  })}
                >
                  <Txt variant={selected ? 'title' : 'body'} size={15} style={{ flex: 1 }}>
                    {s.name}
                  </Txt>
                  <Radio selected={selected} />
                </Pressable>
              );
            })}
            {subdivisions.length ? null : (
              <Txt muted style={{ padding: 16, textAlign: 'center' }}>
                {t('onboarding.place.none')}
              </Txt>
            )}
          </View>
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
      <View style={{ gap: 24 }}>
        <StepHeader
          icon="calendar"
          tint="mango"
          title={t('onboarding.dob.title')}
          body={t('onboarding.dob.body')}
        />
        {Platform.OS === 'ios' ? (
          // iOS: wheel, as in the approved canvas.
          <View
            style={{
              borderRadius: radius.card,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.line,
              alignItems: 'center',
            }}
          >
            <DateTimePicker
              value={value}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={pick}
              locale={locale}
            />
          </View>
        ) : (
          // Android: a large field that opens the Material calendar dialog.
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
                // Only the buttons can be tinted from JS; the header follows the native app theme.
                positiveButton: { textColor: c.ink },
                negativeButton: { textColor: c.muted },
              })
            }
            style={({ pressed }) => ({
              minHeight: 84,
              borderRadius: radius.card,
              borderWidth: dobDate ? 2 : 1.5,
              borderColor: dobDate ? c.ink : c.line,
              backgroundColor: pressed ? c.surface2 : c.surface,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            })}
          >
            <Icon name="calendar" size={24} color={dobDate ? c.ink : c.muted} />
            {dobDate ? (
              <Txt variant="display" size={28}>
                {formatDate(dobDate)}
              </Txt>
            ) : (
              <Txt variant="label" size={17} muted>
                {t('onboarding.dob.pick')}
              </Txt>
            )}
          </Pressable>
        )}
        <Txt size={13} muted style={{ textAlign: 'center' }}>
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
    const q = fold(groupQuery.trim());
    body = (
      <View style={{ gap: 24 }}>
        <StepHeader
          icon="heart"
          tint="bubblegum"
          title={t('onboarding.groups.title')}
          body={t('onboarding.groups.body')}
        />
        <SearchField
          value={groupQuery}
          onChangeText={setGroupQuery}
          placeholder={t('onboarding.groups.search')}
        />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: 10,
          }}
        >
          {allGroups
            .filter((g) => fold(g.name).includes(q))
            .map((g) => (
              <GroupTile
                key={g.id}
                group={g}
                selected={groups.includes(g.id)}
                onPress={() =>
                  setGroups((gs) =>
                    gs.includes(g.id) ? gs.filter((x) => x !== g.id) : [...gs, g.id],
                  )
                }
              />
            ))}
        </View>
        {groups.map((gid) => {
          const g = allGroups.find((x) => x.id === gid)!;
          const members = [
            ...new Map(
              cards.filter((x) => x.groupId === gid).map((x) => [x.memberId, x.memberName]),
            ),
          ];
          const chosen = bias[gid] ?? 'all';
          return (
            <View
              key={gid}
              style={{
                gap: 12,
                padding: 14,
                borderRadius: radius.card,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Monogram group={g} size={28} />
                <Txt variant="title" size={15} accessibilityRole="header">
                  {t('onboarding.groups.bias', { group: g.name })}
                </Txt>
              </View>
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

  const canGoBack = !isIntro && !!prevStep[step];
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
            gap: 12,
            paddingHorizontal: screenPadding,
            minHeight: 48,
          }}
        >
          {isIntro ? (
            <>
              <View style={{ flex: 1 }}>
                <BinkuMark />
              </View>
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
            </>
          ) : (
            <>
              {/* iOS has no system back: every set-up step gets one on screen. */}
              {canGoBack ? (
                <RoundButton icon="chevronLeft" label={t('onboarding.back')} onPress={back} />
              ) : (
                <View style={{ width: 44 }} />
              )}
              <View style={{ flex: 1, alignItems: 'center' }}>
                {stepIndex >= 0 ? (
                  <StepProgress index={stepIndex} count={setupSteps.length} />
                ) : null}
              </View>
              <View style={{ width: 44 }} />
            </>
          )}
        </View>
      )}
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          // Short steps sit in the middle of the screen; long lists scroll from the top.
          justifyContent: 'center',
          padding: screenPadding,
          paddingBottom: 24,
        }}
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
