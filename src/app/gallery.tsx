// Dev-only component gallery (not shipped to users): section labels are English on purpose.
import { Redirect, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDb, getKv } from '@/data/db';
import { t } from '@/i18n';
import { era, fonts, fontSize, screenPadding, type Era } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { CardMarker, type CardFormat, type CardState } from '@/ui/CardMarker';
import { Chip } from '@/ui/Chip';
import { Icon, type IconName } from '@/ui/icons/Icon';
import { OfflineBanner } from '@/ui/OfflineBanner';
import { Pocket } from '@/ui/Pocket';
import { ScanFrame } from '@/ui/ScanFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Tag } from '@/ui/Tag';
import { Txt } from '@/ui/Txt';

const noop = () => {};
const icons: IconName[] = [
  'home',
  'catalog',
  'scan',
  'binder',
  'profile',
  'camera',
  'search',
  'chevronRight',
  'close',
];
const formats: CardFormat[] = ['album', 'pob', 'luckyDraw', 'event', 'seasonGreetings', 'other'];
const states: (CardState | undefined)[] = [
  { kind: 'have' },
  { kind: 'want' },
  { kind: 'dupe', count: 2 },
  undefined,
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ gap: 12, paddingTop: 18, borderTopWidth: 1, borderTopColor: c.line }}>
      <Txt variant="label" muted accessibilityRole="header">
        {title}
      </Txt>
      {children}
    </View>
  );
}

const Row = ({ children }: { children: ReactNode }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
    {children}
  </View>
);

function Swatch({ name, value }: { name: string; value: string }) {
  const c = useTheme();
  return (
    <View style={{ width: 72, gap: 4 }}>
      <View
        style={{
          height: 40,
          borderRadius: 10,
          backgroundColor: value,
          borderWidth: 1,
          borderColor: c.line,
        }}
      />
      <Txt variant="body" size={12} muted>
        {name}
      </Txt>
    </View>
  );
}

function CatalogStatus() {
  const db = getDb();
  const count = (table: string) =>
    db.getFirstSync<{ n: number }>(`select count(*) n from ${table}`)!.n;
  const synced = getKv(db, 'sync:cards');
  return (
    <Txt size={13}>
      {['groups', 'members', 'releases', 'versions', 'cards']
        .map((tb) => `${tb} ${count(tb)}`)
        .join(' · ')}
      {'\n'}
      {synced
        ? `Last server pull (cards): ${synced}`
        : 'Bundled snapshot only (no server pull yet)'}
    </Txt>
  );
}

export default function Gallery() {
  const router = useRouter();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [chip, setChip] = useState('NEVIRA');
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: screenPadding,
        gap: 18,
      }}
    >
      <Row>
        <Button compact variant="ghost" label="← Back" onPress={() => router.back()} />
      </Row>
      <Txt variant="display" size={46} accessibilityRole="header">
        Gallery
      </Txt>

      <Section title="Local catalog (SQLite)">
        <CatalogStatus />
      </Section>

      <Section title="Type scale">
        {fontSize.slice(0, 5).map((s) => (
          <Txt key={s} variant="display" size={s}>
            Paper Moon {s}
          </Txt>
        ))}
        {fontSize.slice(5).map((s) => (
          <Txt key={s} size={s}>
            Instrument Sans {s} · Colección ñ á é
          </Txt>
        ))}
        <Txt style={{ fontFamily: fonts.hangul }}>지완 · 세오라 (Pretendard)</Txt>
      </Section>

      <Section title="Colour tokens">
        <Row>
          {Object.entries(c).map(([k, v]) => (
            <Swatch key={k} name={k} value={v} />
          ))}
        </Row>
        <Row>
          {Object.entries(era).map(([k, v]) => (
            <Swatch key={k} name={k} value={v} />
          ))}
        </Row>
      </Section>

      <Section title="Icons">
        <Row>
          {icons.map((n) => (
            <Icon key={n} name={n} />
          ))}
        </Row>
      </Section>

      <Section title="Buttons">
        <Button label="Marcar cartas que busco" />
        <Button variant="accent" label={t('dock.scan')} />
        <Button variant="ghost" label={t('states.error.retry')} />
        <Button variant="danger" label="Bloquear" />
        <Row>
          <Button compact label="Compacto" />
          <Button compact variant="ghost" label="Compacto" />
          <Button compact label="Disabled" disabled />
        </Row>
      </Section>

      <Section title="Chips & tags">
        <Row>
          {['NEVIRA', 'SEORA', 'Paper Moon'].map((l) => (
            <Chip key={l} label={l} selected={chip === l} onPress={() => setChip(l)} />
          ))}
        </Row>
        <Row>
          <Tag label="Doble" tone="strong" />
          <Tag label="Enviado" />
          <Tag label="Por valorar" tone="outline" />
          <Tag label="De confianza" />
        </Row>
      </Section>

      <Section title="CardMarker">
        <Row>
          {formats.map((f, i) => (
            <CardMarker
              key={f}
              member={['Jiwan', 'Seora', 'Hana', 'Yuri', 'Mina', 'Dami'][i]}
              album="Paper Moon"
              version={['Ver. A', 'Ver. B', 'LD', 'Fanmeet', 'SG 2026', 'Otro'][i]}
              format={f}
              eraColor={Object.keys(era)[i % 5] as Era}
              state={states[i]}
              holo={f !== 'album'}
              width={100}
            />
          ))}
          <CardMarker
            member="Bubblegum-long-name-member"
            album="An album name that is far too long"
            version="Ver. C"
            format="album"
            eraColor="bubblegum"
            width={100}
          />
        </Row>
      </Section>

      <Section title="Pocket & ScanFrame">
        <Row>
          <Pocket member="Jiwan" width={100} />
          <Pocket member="Seora" width={100}>
            <ScanFrame
              source={require('@/assets/images/icon.png')}
              member="Seora"
              width={100}
              holo
            />
          </Pocket>
          <Pocket member="Hana" width={100}>
            <CardMarker
              member="Hana"
              album="Paper Moon"
              version="POB"
              format="pob"
              eraColor="cobalt"
              width={100}
            />
          </Pocket>
        </Row>
      </Section>

      <Section title="Sheet">
        <Button variant="ghost" label="Open sheet" onPress={() => router.push('/sheet-demo')} />
      </Section>

      <Section title="States">
        <View style={{ marginHorizontal: -screenPadding }}>
          <OfflineBanner pendingPhotos={3} />
        </View>
        <Row>
          <Skeleton width={100} aspectRatio={55 / 85} radius={9} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="80%" height={18} />
            <Skeleton width="50%" height={14} />
          </View>
        </Row>
        <StateView
          illustration="ups"
          title={t('states.error.title')}
          body={t('states.error.body')}
          actions={[{ label: t('states.error.retry'), onPress: noop }]}
          code="E-CAT-404"
        />
        <StateView
          illustration="pocket"
          title={t('states.noResults.title')}
          body={t('states.noResults.body')}
          actions={[{ label: t('states.noResults.action'), onPress: noop }]}
        />
        <StateView
          illustration="camera"
          title={t('states.cameraDenied.title')}
          actions={[
            { label: t('states.cameraDenied.settings'), onPress: noop },
            { label: t('states.cameraDenied.gallery'), onPress: noop, variant: 'ghost' },
          ]}
        />
      </Section>
    </ScrollView>
  );
}
