import { useLocalSearchParams } from 'expo-router';
import { Page } from '../../../src/components/ui';
import { ReleaseReviews } from '../../../src/components/Releases';
export default function ReleaseHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Page>
      <ReleaseReviews key={id} uid={id} />
    </Page>
  );
}
