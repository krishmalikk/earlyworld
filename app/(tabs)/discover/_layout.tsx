import { Stack } from 'expo-router';
import { tabStackOptions } from '../../../src/navigation/tab-stack';
export default function DiscoverLayout() {
  return <Stack screenOptions={tabStackOptions('Discover')} />;
}
