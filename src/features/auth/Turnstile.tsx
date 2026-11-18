// Cloudflare Turnstile (bot check) before sign-in requests: Supabase Auth rejects codes and
// Google sign-ins without a valid token. The widget runs in a tiny WebView whose origin is
// binku.app (the hostname registered for the site key). Tokens are single-use: the caller
// remounts it (new `key`) after each request.
import { View, useColorScheme } from 'react-native';
import WebView from 'react-native-webview';

import { TURNSTILE_SITE_KEY } from '@/config';
import { locale } from '@/i18n';

type Props = {
  /** A fresh token, or null when it expired / failed (the widget retries by itself). */
  onToken: (token: string | null) => void;
};

export function Turnstile({ onToken }: Props) {
  const dark = useColorScheme() === 'dark';
  const html = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=ready&render=explicit" async defer></script>
<style>html,body{margin:0;padding:0;background:transparent;display:flex;justify-content:center}</style>
</head><body><div id="w"></div><script>
function post(m){window.ReactNativeWebView.postMessage(JSON.stringify(m))}
function ready(){turnstile.render('#w',{sitekey:'${TURNSTILE_SITE_KEY}',theme:'${dark ? 'dark' : 'light'}',language:'${locale}',size:'flexible',
callback:function(t){post({token:t})},'expired-callback':function(){post({token:null})},'error-callback':function(){post({token:null})}})}
</script></body></html>`;

  return (
    <View style={{ height: 68, overflow: 'hidden' }}>
      <WebView
        source={{ html, baseUrl: 'https://binku.app' }}
        originWhitelist={['https://*']}
        onMessage={(e) => {
          try {
            onToken((JSON.parse(e.nativeEvent.data) as { token?: string | null }).token ?? null);
          } catch {
            onToken(null);
          }
        }}
        scrollEnabled={false}
        // Transparent so it sits on the screen background in light and dark.
        style={{ backgroundColor: 'transparent' }}
        containerStyle={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
}
