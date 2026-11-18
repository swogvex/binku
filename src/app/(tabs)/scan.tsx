// Escanear tab: the tips before the first scan (canvas ios-escanear), or why scanning can't
// start (camera denied on iOS, no scanner on this Android). After the first scan the dock
// button opens the scanner directly (see the tabs layout).
import { useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Platform, View } from 'react-native';

import { openScan } from '@/features/scan/scan';
import { t } from '@/i18n';
import { textOn } from '@/lib/contrast';
import { era, radius, type Era } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { Icon, type IconName } from '@/ui/icons/Icon';
import { StateView } from '@/ui/StateView';
import { TabScreen } from '@/ui/TabScreen';
import { Txt } from '@/ui/Txt';

const TIPS: { key: 'tipDark' | 'tipLight' | 'tipShine'; icon: IconName; color: Era }[] = [
  { key: 'tipDark', icon: 'image', color: 'cobalt' },
  { key: 'tipLight', icon: 'sun', color: 'mango' },
  { key: 'tipShine', icon: 'sparkle', color: 'mint' },
];

function Tip({ tip }: { tip: (typeof TIPS)[number] }) {
  const c = useTheme();
  const bg = era[tip.color];
  return (
    <View
      accessible
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 14,
        borderRadius: radius.control,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={tip.icon} size={28} color={textOn(bg)} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt variant="title" size={15}>
          {t(`scan.${tip.key}.title`)}
        </Txt>
        <Txt size={13} muted>
          {t(`scan.${tip.key}.body`)}
        </Txt>
      </View>
    </View>
  );
}

export default function ScanScreen() {
  const c = useTheme();
  const router = useRouter();
  const { blocked } = useLocalSearchParams<{ blocked?: 'denied' | 'unavailable' }>();
  const [permission] = useCameraPermissions();
  const gallery = () => openScan(router, 'gallery');

  // iOS only: Android never asks for the camera (the ML Kit scanner has its own).
  const denied = Platform.OS === 'ios' && permission?.status === 'denied';
  if (denied || blocked === 'unavailable') {
    return (
      <TabScreen>
        <StateView
          illustration="camera"
          title={denied ? t('states.cameraDenied.title') : t('scan.unavailable.title')}
          body={denied ? t('states.cameraDenied.body') : t('scan.unavailable.body')}
          actions={[
            ...(denied
              ? [
                  {
                    label: t('states.cameraDenied.settings'),
                    onPress: () => Linking.openSettings(),
                  },
                ]
              : []),
            {
              label: t('states.cameraDenied.gallery'),
              icon: 'image' as const,
              variant: denied ? ('ghost' as const) : undefined,
              onPress: gallery,
            },
          ]}
        />
      </TabScreen>
    );
  }

  return (
    <TabScreen>
      <View style={{ gap: 8 }}>
        <Txt variant="label" muted>
          {t('scan.kicker')}
        </Txt>
        <Txt variant="display" size={40} accessibilityRole="header">
          {t('scan.title')}
        </Txt>
      </View>
      <View style={{ gap: 12 }}>
        {TIPS.map((tip) => (
          <Tip key={tip.key} tip={tip} />
        ))}
      </View>
      <View
        accessible
        style={{
          flexDirection: 'row',
          gap: 10,
          padding: 14,
          borderRadius: radius.control,
          backgroundColor: c.surface2,
        }}
      >
        <Icon name="lock" size={20} />
        <Txt size={13} style={{ flex: 1 }}>
          {Platform.OS === 'ios' ? t('scan.privacyAsk') : t('scan.privacy')}
        </Txt>
      </View>
      <View style={{ gap: 10 }}>
        <Button
          label={t('scan.camera')}
          icon="camera"
          variant="accent"
          onPress={() => openScan(router, 'camera')}
        />
        <Button label={t('scan.gallery')} icon="image" variant="ghost" onPress={gallery} />
      </View>
    </TabScreen>
  );
}
