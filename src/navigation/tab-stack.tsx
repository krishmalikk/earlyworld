import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';
import { fontFamily, fontSize, fontWeight } from '../../shared/theme';
import { colors as c } from '../../shared/brand';

type StackOptions = NonNullable<ComponentProps<typeof Stack>['screenOptions']>;
/** Header for the Stack inside each native tab; native tabs draw no header of their own. */
export function tabStackOptions(title: string): StackOptions {
  return {
    title,
    headerStyle: { backgroundColor: c.bg },
    headerTintColor: c.text,
    headerTitleAlign: 'left',
    headerTitleStyle: {
      fontSize: fontSize.section,
      fontFamily: fontFamily.displayBold,
      fontWeight: fontWeight.regular,
    },
    headerShadowVisible: false,
    headerBackTitle: 'Back',
    contentStyle: { backgroundColor: c.bg },
  };
}
