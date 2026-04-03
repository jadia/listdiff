import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  createSessionId, 
  saveSnapshot, 
  getHistory, 
  deleteEntry,
  clearAllHistory
} from '../js/history.js';

describe('History Module', () => {
  let localStorageMock;

  beforeEach(() => {
    /* Mock localStorage */
    let store = {};
    localStorageMock = {
      getItem: vi.fn(key => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
      removeItem: vi.fn(key => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; })
    };
    vi.stubGlobal('localStorage', localStorageMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates a session ID starting with "session-"', () => {
    const id = createSessionId();
    expect(id).toMatch(/^session-[a-z0-9]{6}$/);
  });

  it('can save and retrieve a snapshot', () => {
    const sessionId = 'session-123';
    const data = {
      listA: ['apple', 'banana'],
      listB: ['cherry'],
      options: { caseSensitive: true }
    };

    saveSnapshot(sessionId, data);
    const history = getHistory();

    expect(history).toHaveLength(1);
    expect(history[0].sessionId).toBe(sessionId);
    expect(history[0].data.listA).toEqual(['apple', 'banana']);
    expect(history[0].data.options.caseSensitive).toBe(true);
    expect(history[0].timestamp).toBeDefined();
  });

  it('updates an existing session and moves it to the top', () => {
    const s1 = 'session-1';
    const s2 = 'session-2';

    saveSnapshot(s1, { listA: ['one'], listB: [], options: {} });
    saveSnapshot(s2, { listA: ['two'], listB: [], options: {} });
    
    // session-2 should be at the top initially
    let history = getHistory();
    expect(history[0].sessionId).toBe(s2);

    // update session-1
    saveSnapshot(s1, { listA: ['one-updated'], listB: [], options: {} });
    history = getHistory();

    // session-1 should have moved to the top
    expect(history[0].sessionId).toBe(s1);
    expect(history[0].data.listA).toEqual(['one-updated']);
    expect(history).toHaveLength(2);
  });

  it('deletes an entry correctly', () => {
    saveSnapshot('session-x', { listA: [], listB: [], options: {} });
    saveSnapshot('session-y', { listA: [], listB: [], options: {} });

    let history = getHistory();
    expect(history).toHaveLength(2);

    deleteEntry('session-x');
    history = getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].sessionId).toBe('session-y');
  });

  it('clears all history', () => {
    saveSnapshot('session-a', { listA: [], listB: [], options: {} });
    saveSnapshot('session-b', { listA: [], listB: [], options: {} });

    clearAllHistory();
    const history = getHistory();
    expect(history).toHaveLength(0);
  });
});
