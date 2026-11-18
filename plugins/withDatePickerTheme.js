// Android date dialog in Binku colours instead of the default teal (owner approved, 2026-11-18).
// The dialog is native: its header and selected day follow the theme's accent, which JS cannot set.
// #C23A20 = token accentText: white text on it passes WCAG AA, and it reads on light and dark.
const { AndroidConfig, withAndroidStyles } = require('expo/config-plugins');

const STYLE = 'BinkuDatePickerDialog';

module.exports = function withDatePickerTheme(config, { accent = '#C23A20' } = {}) {
  return withAndroidStyles(config, (cfg) => {
    const { Styles } = AndroidConfig;
    const xml = cfg.modResults;
    xml.resources.style = (xml.resources.style ?? []).filter((s) => s.$.name !== STYLE);
    xml.resources.style.push({
      $: { name: STYLE, parent: 'Theme.AppCompat.DayNight.Dialog' },
      item: [
        { $: { name: 'colorAccent' }, _: accent },
        { $: { name: 'android:colorAccent' }, _: accent },
      ],
    });
    cfg.modResults = Styles.assignStylesValue(xml, {
      add: true,
      parent: Styles.getAppThemeGroup(),
      name: 'android:datePickerDialogTheme',
      value: `@style/${STYLE}`,
    });
    return cfg;
  });
};
