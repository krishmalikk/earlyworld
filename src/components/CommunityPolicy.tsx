import { Text } from 'react-native';
import { s, Section } from './ui';
import { communityRules, communityPrivacy } from '../../shared/community-policy';
export function CommunityPolicy({ section }: { section?: 'rules' | 'privacy' }) {
  return (
    <>
      {section !== 'privacy' && (
        <Section title="Community rules">
          {communityRules.map((text, i) => (
            <Text key={text} style={i === 0 ? s.text : s.muted}>
              {text}
            </Text>
          ))}
        </Section>
      )}
      {section !== 'rules' && (
        <Section title="Privacy">
          {communityPrivacy.map((text, i) => (
            <Text key={text} style={i === 0 ? s.text : s.muted}>
              {text}
            </Text>
          ))}
        </Section>
      )}
    </>
  );
}
