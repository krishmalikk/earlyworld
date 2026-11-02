import { Stack } from 'expo-router';
import { tabStackOptions } from '../../../src/navigation/tab-stack';
export default function CreateLayout() {
  return <Stack screenOptions={tabStackOptions('Create')} />;
}
