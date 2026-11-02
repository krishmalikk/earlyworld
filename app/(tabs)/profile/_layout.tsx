import { Stack } from 'expo-router';
import { tabStackOptions } from '../../../src/navigation/tab-stack';
export default function ProfileLayout() {
  return <Stack screenOptions={tabStackOptions('Profile')} />;
}
