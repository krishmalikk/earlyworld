import test from 'node:test';
import assert from 'node:assert/strict';
import { qualityIssues } from '../scripts/check-quality';

test('quality checks parse actual source, including aliased Image imports', () => {
  const bad = `import {Image as NativeImage} from 'react-native';
    const styles = {color:'#fff',padding:12,fontSize:14,fontWeight:'600'};
    const x: any = response.body.getReader();`;
  assert.equal(qualityIssues('Example.tsx', bad).length, 6);
  assert.deepEqual(
    qualityIssues(
      'Example.tsx',
      `
    // Historical example: padding: 12 and Image from react-native.
    import {Image} from 'expo-image';
    const styles = {color:colors.text,padding:space[12],fontSize:fontSize.body,width:48};
    const value = 12; const dynamic = {fontSize:size * 0.28};
  `,
    ),
    [],
  );
});
