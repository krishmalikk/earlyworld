import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Entity, Rotation } from '../data/types';
import type { EntityType } from '../../shared/domain';
import { Artwork, c, s, TierBadge } from './ui';
export function EntityCard({
  entity,
  type,
  rotation,
  selected,
  onPress,
}: {
  entity: Entity;
  type: EntityType;
  rotation?: Rotation;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={
        onPress ||
        (() => router.push({ pathname: '/entity/[id]', params: { id: entity.id, type } }))
      }
      style={[s.panel, { width: '48%', borderColor: selected ? c.accent : c.line, gap: 9 }]}
    >
      <View style={s.between}>
        <Artwork uri={entity.imageUrl} name={entity.name} size={42} />
        <Text style={[s.mono, { fontSize: 8 }]}>
          {selected ? '✓' : type === 'producer' ? 'PROD.' : 'ARTIST'}
        </Text>
      </View>
      <Text numberOfLines={1} style={[s.text, { fontWeight: '600' }]}>
        {entity.name}
      </Text>
      {rotation ? (
        <>
          <TierBadge tier={rotation.tier} />
          <Text style={{ color: c.muted, fontSize: 9 }}>
            since{' '}
            {rotation.firstEngagedAt
              ?.toDate()
              .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
        </>
      ) : (
        <Text numberOfLines={2} style={{ color: c.muted, fontSize: 10, lineHeight: 15 }}>
          {entity.scenes?.join(' / ') || `${entity.trackCount} tracks`}
        </Text>
      )}
    </Pressable>
  );
}
