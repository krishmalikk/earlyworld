import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { call, errorMessage } from '../../src/lib/firebase';
import { Artwork, Button, Chip, ErrorLine, Field, Heading, Page, s } from '../../src/components/ui';
export default function Add() {
  const [url, setUrl] = useState(''),
    [title, setTitle] = useState(''),
    [artist, setArtist] = useState(''),
    [producer, setProducer] = useState(''),
    [artwork, setArtwork] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function preview() {
    setBusy(true);
    setError(null);
    try {
      const data = await call<{ title: string; artistName: string; artworkUrl: string }>(
        'previewTrack',
        { sourceUrl: url },
      );
      setTitle(data.title);
      setArtist(data.artistName);
      setArtwork(data.artworkUrl);
      setLoaded(true);
    } catch (e) {
      setLoaded(true);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const data = await call<{ trackId: string }>('addTrack', {
        sourceUrl: url,
        title,
        artistName: artist,
        producerName: producer,
        publicReleaseConfirmed: confirmed,
      });
      setUrl('');
      setTitle('');
      setArtist('');
      setProducer('');
      setLoaded(false);
      setConfirmed(false);
      router.push(`/track/${data.trackId}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading eyebrow="ADD TO THE CATALOG" title="Put us on." />
      <Text style={s.muted}>A public track. Its original source. Credit where it's due.</Text>
      <Field
        accessibilityLabel="Track URL"
        placeholder="SoundCloud, YouTube, or Bandcamp URL"
        autoCapitalize="none"
        autoCorrect={false}
        value={url}
        onChangeText={(text) => {
          setUrl(text);
          setLoaded(false);
        }}
      />
      <Button onPress={preview} busy={busy} disabled={!url}>
        Find track
      </Button>
      {loaded ? (
        <>
          <View style={s.row}>
            <Artwork uri={artwork} name={title || 'ew'} size={52} />
            <Text style={[s.muted, { flex: 1 }]}>
              Check the details. Upload titles and channel names aren't always the artist.
            </Text>
          </View>
          <Text style={s.mono}>TRACK TITLE</Text>
          <Field value={title} onChangeText={setTitle} placeholder="Title" />
          <Text style={s.mono}>ARTIST</Text>
          <Field value={artist} onChangeText={setArtist} placeholder="Artist name" />
          <Text style={s.mono}>PRODUCER / FIRST-CLASS CREDIT</Text>
          <Field
            value={producer}
            onChangeText={setProducer}
            placeholder="Producer name, if known"
          />
          <Text style={s.muted}>Don't guess. A missing credit is better than the wrong one.</Text>
          <Chip
            label="This is a public, published release"
            selected={confirmed}
            onPress={() => setConfirmed(!confirmed)}
          />
          <Button
            disabled={!title.trim() || !artist.trim() || !confirmed}
            busy={busy}
            onPress={submit}
          >
            Add track
          </Button>
        </>
      ) : null}
      <ErrorLine message={error} />
    </Page>
  );
}
