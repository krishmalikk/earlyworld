import { Profile } from '../../src/components/Profile';
import { useLocal } from '../../src/state/local';
export default function MyProfile() {
  const uid = useLocal((s) => s.uid);
  return uid ? <Profile uid={uid} /> : null;
}
