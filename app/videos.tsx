import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, s } from '../src/components/ui';
import { VideoFeed } from '../src/components/VideoFeed';
export default function Videos() {
  const { start } = useLocalSearchParams<{ start?: string }>();
  return (
    <SafeAreaView style={s.page}>
      <Button quiet onPress={() => router.back()}>
        Back
      </Button>
      <VideoFeed start={start} />
    </SafeAreaView>
  );
}
