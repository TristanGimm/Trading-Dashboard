import test from 'node:test';
import assert from 'node:assert/strict';
import {
  algorithmTone, conditionTone, sessionTone, setupTone, timeframeMinutes, timeframeTone,
} from '../lib/tags.ts';

test('algorithms: CBR blue, CBC green, everything else neutral', () => {
  assert.equal(algorithmTone('CBR'), 'blue');
  assert.equal(algorithmTone('cbc'), 'green');
  assert.equal(algorithmTone('Stocks'), 'grey');
  assert.equal(algorithmTone(null), 'grey');
});

test('setups: continuation green, reversal red, block and bare reversal blue, structure grey', () => {
  assert.equal(setupTone('HTF Continuation'), 'green');
  assert.equal(setupTone('LTF Continuation'), 'green');
  assert.equal(setupTone('HTF Reversal'), 'red');
  assert.equal(setupTone('LTF Reversal'), 'red');
  assert.equal(setupTone('Continuation Block'), 'blue');
  assert.equal(setupTone('Reversal'), 'blue');
  assert.equal(setupTone('Prev Structure'), 'grey');
  assert.equal(setupTone('Range rejection'), 'grey');
});

test('conditions: bearish red, bullish green, a pure range grey', () => {
  assert.equal(conditionTone('Bearish'), 'red');
  assert.equal(conditionTone('Bearish Ranging'), 'red');
  assert.equal(conditionTone('Bullish'), 'green');
  assert.equal(conditionTone('Bullish Ranging'), 'green');
  assert.equal(conditionTone('Ranging'), 'grey');
});

test('sessions: London green, New York red, Sydney purple, Asia/Tokyo yellow', () => {
  assert.equal(sessionTone('London Opening'), 'green');
  assert.equal(sessionTone('New York Medium'), 'red');
  assert.equal(sessionTone('Sydney End'), 'purple');
  assert.equal(sessionTone('Asia'), 'yellow');
  assert.equal(sessionTone('Tokio Opening'), 'yellow');
  assert.equal(sessionTone('Frankfurt'), 'grey');
});

test('timeframes climb the quality ladder as the interval grows', () => {
  assert.equal(timeframeMinutes('5s Type 3'), 5 / 60);
  assert.equal(timeframeMinutes('1hr Type 3'), 60);
  assert.equal(timeframeTone('5s'), 'grey');
  assert.equal(timeframeTone('1m'), 'yellow');
  assert.equal(timeframeTone('5m Type 1'), 'green');
  assert.equal(timeframeTone('15m Type 2'), 'blue');
  assert.equal(timeframeTone('30m'), 'blue');
  assert.equal(timeframeTone('1h'), 'purple');
  assert.equal(timeframeTone('4hr Type 3'), 'prismatic');
  assert.equal(timeframeTone('unknown'), 'grey');
});
