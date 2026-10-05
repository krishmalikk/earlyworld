import { ActivityIndicator, View } from 'react-native';
import { space } from '../shared/theme';
import { Brand } from '../src/components/Brand';
import { WelcomeScreen } from '../src/components/WelcomeScreen';
import { c, s } from '../src/components/ui';
import { useLocal } from '../src/state/local';

export default function Index() {
  const uid = useLocal((state) => state.uid);
  const authReady = useLocal((state) => state.authReady);
  // Never flash the first-run pitch while Firebase restores an existing session.
  if (!authReady || uid)
    return (
      <View style={[s.page, { justifyContent: 'center', alignItems: 'center', gap: space[24] }]}>
        <Brand variant="loading" />
        <ActivityIndicator color={c.accent} accessibilityLabel="Opening earlyworld" />
      </View>
    );
  return <WelcomeScreen />;
}
