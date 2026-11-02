import { Stack } from 'expo-router';
import { tabStackOptions } from '../../../src/navigation/tab-stack';
export default function MatchesLayout() {
  return <Stack screenOptions={tabStackOptions('Matches')} />;
}
