import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { fontSize } from '../../shared/theme';
import { BottomInsetHandledContext, c } from '../../src/components/ui';

/**
 * The system tab bar: Liquid Glass on iOS 26, the standard bar on older iOS, Material on
 * Android. Headers live in each tab's own Stack. Scroll views run under the bar; iOS insets
 * the first one automatically and Android wraps screens in a bottom safe area.
 */
export default function TabLayout() {
  return (
    <BottomInsetHandledContext.Provider value={true}>
      <NativeTabs
        tintColor={c.accent}
        iconColor={{ default: c.muted, selected: c.accent }}
        labelStyle={{
          default: { color: c.muted, fontSize: fontSize.smallCaption },
          selected: { color: c.accent, fontSize: fontSize.smallCaption },
        }}
        // Only iOS 18 and earlier use these; iOS 26 derives the glass from what is behind it.
        backgroundColor={c.bg}
        blurEffect="systemChromeMaterialDark"
        shadowColor={c.line}
        disableTransparentOnScrollEdge
        minimizeBehavior="onScrollDown"
        indicatorColor={c.selected}
        rippleColor={c.selected}
      >
        <NativeTabs.Trigger name="(feed)">
          <NativeTabs.Trigger.Label>Feed</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'rectangle.stack', selected: 'rectangle.stack.fill' }}
            md="home"
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="discover">
          <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="create">
          <NativeTabs.Trigger.Label>Create</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }}
            md="add_circle"
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="matches">
          <NativeTabs.Trigger.Label>Matches</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person.2', selected: 'person.2.fill' }}
            md="group"
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person', selected: 'person.fill' }}
            md="person"
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </BottomInsetHandledContext.Provider>
  );
}
