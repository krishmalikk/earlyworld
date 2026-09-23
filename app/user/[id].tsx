import { useLocalSearchParams } from 'expo-router';
import { Profile } from '../../src/components/Profile';
export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Profile key={id} uid={id} />;
}
