import { Stack, useLocalSearchParams } from 'expo-router';
import { Page } from '../../src/components/ui';
import { CommunityPolicy } from '../../src/components/CommunityPolicy';
export default function Policy() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const selected = section === 'rules' ? 'rules' : 'privacy';
  return (
    <Page>
      <Stack.Screen
        options={{ title: selected === 'rules' ? 'Community rules' : 'Privacy & access' }}
      />
      <CommunityPolicy section={selected} />
    </Page>
  );
}
