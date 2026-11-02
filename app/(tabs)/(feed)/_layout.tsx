import { Stack } from 'expo-router';
import { fontFamily, fontSize, fontWeight } from '../../../shared/theme';
import { tabStackOptions } from '../../../src/navigation/tab-stack';
import { ActivityBell } from '../../../src/components/ActivityBell';
export default function FeedLayout() {
  return (
    <Stack
      screenOptions={{
        ...tabStackOptions('Feed'),
        headerTitle: 'earlyworld',
        headerRight: () => <ActivityBell />,
        headerTitleStyle: {
          fontSize: fontSize.brandCompact,
          fontFamily: fontFamily.displayBold,
          fontWeight: fontWeight.regular,
        },
      }}
    />
  );
}
