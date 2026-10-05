import { Text } from 'react-native';
import { s, Section } from './ui';
export function CommunityPolicy({ section }: { section?: 'rules' | 'privacy' }) {
  return (
    <>
      {section !== 'privacy' && (
        <Section title="Community rules">
          <Text style={s.text}>
            Post only media you created or have permission to share. No harassment, threats, sexual
            content, hate, exploitation, or disclosure of someone’s private information. Music clips
            must have sharing permission too.
          </Text>
          <Text style={s.muted}>
            Posts, videos, written reviews, comments, and public profile changes are reviewed before
            publication. You can report content, block users, or delete your own submissions.
          </Text>
        </Section>
      )}
      {section !== 'rules' && (
        <Section title="Privacy">
          <Text style={s.text}>
            Community content is visible to signed-in listeners. Your bookmarks, drafts, reports,
            and eligibility information are private. We do not display your age or collect location
            for this feature. Video storage and processing use Google Cloud.
          </Text>
          <Text style={s.muted}>
            This launch has no direct messages, contact discovery, or targeted advertising. Deleting
            your account removes your authored content and media through a queued cleanup; signed
            media links can remain valid briefly until they expire. This initial policy remains
            subject to the public-launch review.
          </Text>
        </Section>
      )}
    </>
  );
}
