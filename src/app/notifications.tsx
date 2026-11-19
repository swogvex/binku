// "Avisos de coincidencias" sheet: on/off (asks the system permission the first time) and
// quiet hours. Minors start with their country's quiet hours (22:00–09:00 in Spain).
import { useEffect, useState } from 'react';
import { Linking, ScrollView, Switch, View } from 'react-native';

import {
  disableMatchAlerts,
  enableMatchAlerts,
  loadAlertSettings,
  setQuietHours,
  type Quiet,
} from '@/features/notifications/push';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Txt } from '@/ui/Txt';

const QUIET: Exclude<Quiet, null>[] = ['off', '22:00-09:00', '23:00-08:00'];

export default function NotificationsSheet() {
  const c = useTheme();
  const [on, setOn] = useState<boolean>();
  const [quiet, setQuiet] = useState<Exclude<Quiet, null>>('off');
  const [problem, setProblem] = useState<'denied' | 'error' | null>(null);

  useEffect(() => {
    loadAlertSettings()
      .then((s) => {
        setOn(!!s?.notify_matches);
        setQuiet(s?.quiet_hours ?? (s?.is_minor ? '22:00-09:00' : 'off'));
      })
      .catch(() => setProblem('error'));
  }, []);

  const toggle = async (next: boolean) => {
    haptics.selection();
    setProblem(null);
    setOn(next);
    try {
      if (!next) await disableMatchAlerts();
      else if (!(await enableMatchAlerts())) {
        setOn(false);
        setProblem('denied');
      }
    } catch {
      setOn(!next);
      setProblem('error');
    }
  };

  const pickQuiet = (q: Exclude<Quiet, null>) => {
    const before = quiet;
    setQuiet(q);
    setQuietHours(q).catch(() => {
      setQuiet(before);
      setProblem('error');
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.surface }}
      contentContainerStyle={{ padding: screenPadding, paddingTop: 28, gap: 18 }}
    >
      <Txt variant="title" size={22} accessibilityRole="header">
        {t('alerts.title')}
      </Txt>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: c.line,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="title" size={15}>
            {t('alerts.matches')}
          </Txt>
          <Txt size={13} muted>
            {t('alerts.matchesBody')}
          </Txt>
        </View>
        <Switch
          value={!!on}
          disabled={on === undefined}
          onValueChange={toggle}
          accessibilityLabel={t('alerts.matches')}
          trackColor={{ true: c.ink, false: c.line }}
        />
      </View>

      {problem === 'denied' ? (
        <View style={{ gap: 10 }}>
          <Txt size={13} color={c.accentText} accessibilityLiveRegion="polite">
            {t('alerts.denied')}
          </Txt>
          <Button
            label={t('alerts.openSettings')}
            variant="ghost"
            onPress={() => Linking.openSettings()}
          />
        </View>
      ) : problem === 'error' ? (
        <Txt size={13} color={c.accentText} accessibilityLiveRegion="polite">
          {t('alerts.error')}
        </Txt>
      ) : null}

      <View style={{ gap: 10 }}>
        <Txt variant="title" size={15} accessibilityRole="header">
          {t('alerts.quiet')}
        </Txt>
        <Txt size={13} muted>
          {t('alerts.quietBody')}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUIET.map((q) => (
            <Chip
              key={q}
              label={q === 'off' ? t('alerts.quietOff') : q.replace('-', '–')}
              selected={quiet === q}
              onPress={() => pickQuiet(q)}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
