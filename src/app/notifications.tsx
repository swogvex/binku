// Alerts sheet: matches and messages on/off (asks the system permission the first time) and
// quiet hours. Minors start with their country's quiet hours (22:00–09:00 in Spain).
import { useEffect, useState } from 'react';
import { Linking, ScrollView, Switch, View } from 'react-native';

import {
  disableMatchAlerts,
  disableMessageAlerts,
  enableMatchAlerts,
  enableMessageAlerts,
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

type Kind = 'matches' | 'messages';
const API = {
  matches: { on: enableMatchAlerts, off: disableMatchAlerts },
  messages: { on: enableMessageAlerts, off: disableMessageAlerts },
};

function AlertRow({
  title,
  body,
  value,
  onChange,
}: {
  title: string;
  body: string;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  const c = useTheme();
  return (
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
          {title}
        </Txt>
        <Txt size={13} muted>
          {body}
        </Txt>
      </View>
      <Switch
        value={!!value}
        disabled={value === undefined}
        onValueChange={onChange}
        accessibilityLabel={title}
        trackColor={{ true: c.ink, false: c.line }}
        thumbColor={c.surface}
      />
    </View>
  );
}

const QUIET: Exclude<Quiet, null>[] = ['off', '22:00-09:00', '23:00-08:00'];

export default function NotificationsSheet() {
  const c = useTheme();
  const [on, setOn] = useState<Partial<Record<Kind, boolean>>>({});
  const [quiet, setQuiet] = useState<Exclude<Quiet, null>>('off');
  const [problem, setProblem] = useState<'denied' | 'error' | null>(null);

  useEffect(() => {
    loadAlertSettings()
      .then((s) => {
        // messages are on by default on the server, but only reach a phone that allowed them
        setOn({
          matches: !!s?.notify_matches,
          messages: !!s?.notify_messages && !!s?.permitted,
        });
        setQuiet(s?.quiet_hours ?? (s?.is_minor ? '22:00-09:00' : 'off'));
      })
      .catch(() => setProblem('error'));
  }, []);

  const toggle = async (kind: Kind, next: boolean) => {
    haptics.selection();
    setProblem(null);
    setOn((o) => ({ ...o, [kind]: next }));
    try {
      if (!next) await API[kind].off();
      else if (!(await API[kind].on())) {
        setOn((o) => ({ ...o, [kind]: false }));
        setProblem('denied');
      }
    } catch {
      setOn((o) => ({ ...o, [kind]: !next }));
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
      <AlertRow
        title={t('alerts.matches')}
        body={t('alerts.matchesBody')}
        value={on.matches}
        onChange={(v) => toggle('matches', v)}
      />
      <AlertRow
        title={t('alerts.messages')}
        body={t('alerts.messagesBody')}
        value={on.messages}
        onChange={(v) => toggle('messages', v)}
      />

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
