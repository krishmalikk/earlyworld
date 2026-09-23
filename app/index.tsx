import { View, Text } from 'react-native';
import { c, s } from '../src/components/ui';
export default function Index() {
  return (
    <View style={[s.page, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={[s.title, { color: c.accent }]}>earlyworld</Text>
    </View>
  );
}
