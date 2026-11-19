// Onboarding intros: three illustrated pages you can swipe back and forth or step through with
// "Siguiente". The last page only continues with the button (to the welcome screen).
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { t } from '@/i18n';
import { cardRadius, cardRatio, era, radius, screenPadding, type Era } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CardMarker } from '@/ui/CardMarker';
import { Icon } from '@/ui/icons/Icon';
import { Txt } from '@/ui/Txt';

export const INTROS = ['collect', 'mark', 'match'] as const;

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
  const fill: (Era | null)[][] = [
    ['cobalt', null, 'mint'],
    [null, 'bubblegum', null],
    ['mango', null, 'cobalt'],
  ];
  // Explicit size (no aspectRatio): RN mis-measures aspectRatio children in wrapped rows.
  const W = 40;
  const pocket = { width: W, height: Math.round(W / cardRatio), borderRadius: cardRadius(W) };
  return (
    <View
      style={{
        padding: 12,
        gap: 7,
        borderRadius: 18,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      {fill.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 7 }}>
          {row.map((e, col) =>
            e ? (
              <View key={col} style={[pocket, { backgroundColor: era[e] }]} />
            ) : (
              <View
                key={col}
                style={[
                  pocket,
                  {
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    // Middle-right: the logo's filled pocket, where the loose card goes.
                    borderColor: r === 1 && col === 2 ? c.ink : c.muted,
                    backgroundColor: c.surface2,
                  },
                ]}
              />
            ),
          )}
        </View>
      ))}
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
          <Txt
            variant="label"
            size={12}
            color={s === 'want' ? c.onInk : c.ink}
            allowFontScaling={false}
          >
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
            transform: [{ translateX: 84 }, { translateY: 52 }, { rotate: '13deg' }],
          }}
        >
          <CardMarker
            decorative
            member="Hana"
            album="Paper Moon"
            version="Ver. A"
            format="album"
            eraColor="tomato"
            width={80}
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
            decorative
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
            decorative
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
            decorative
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
          decorative
          member="Jiwan"
          album="Paper Moon"
          version="Ver. B"
          format="album"
          eraColor="mint"
          width={84}
        />
        <Txt variant="label" size={12} muted allowFontScaling={false}>
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
          decorative
          member="Seora"
          album="Paper Moon"
          version="LD"
          format="luckyDraw"
          eraColor="bubblegum"
          width={84}
        />
        <Txt variant="label" size={12} muted allowFontScaling={false}>
          {t('onboarding.intro.youHave')}
        </Txt>
      </View>
    </Circle>
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

type Props = { index: number; onIndex: (i: number) => void };

export function IntroPager({ index, onIndex }: Props) {
  const { width } = useWindowDimensions();
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const shown = useRef(index);
  // Initial page only: Android re-applies a new contentOffset object on every render.
  const [initialOffset] = useState(() => ({ x: index * width, y: 0 }));

  // "Siguiente" (or coming back from the welcome) moves the pager; a swipe only reports.
  useEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    pager.current?.scrollTo({ x: index * width, animated: true });
  }, [index, width]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={initialOffset}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (i === shown.current) return;
          shown.current = i;
          onIndex(i);
        }}
        style={{ flex: 1 }}
      >
        {INTROS.map((kind, i) => (
          <ScrollView
            key={kind}
            style={{ width }}
            // Off-screen pages are hidden from screen readers; the button/dots say where you are.
            importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}
            accessibilityElementsHidden={i !== index}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 28,
              padding: screenPadding,
            }}
          >
            <IntroArt kind={kind} />
            <View style={{ alignItems: 'center', gap: 10 }}>
              <Txt
                variant="display"
                size={46}
                accessibilityRole="header"
                style={{ textAlign: 'center' }}
              >
                {t(`onboarding.intro.${kind}.title`)}
              </Txt>
              <Txt size={17} muted style={{ textAlign: 'center', maxWidth: 320 }}>
                {t(`onboarding.intro.${kind}.body`)}
              </Txt>
            </View>
          </ScrollView>
        ))}
      </ScrollView>
      <View style={{ alignItems: 'center', paddingVertical: 12 }}>
        <PageDots index={index} count={INTROS.length} />
      </View>
    </View>
  );
}
