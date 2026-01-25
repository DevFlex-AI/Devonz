import { describe, expect, it } from 'vitest';
import { chatStore, setPendingChatMessage, clearPendingChatMessage } from './chat';

describe('chatStore', () => {
  describe('initial state', () => {
    it('should have started as false', () => {
      const state = chatStore.get();
      expect(state.started).toBe(false);
    });

    it('should have aborted as false', () => {
      const state = chatStore.get();
      expect(state.aborted).toBe(false);
    });

    it('should have showChat as true', () => {
      const state = chatStore.get();
      expect(state.showChat).toBe(true);
    });

    it('should have pendingMessage as null', () => {
      const state = chatStore.get();
      expect(state.pendingMessage).toBeNull();
    });
  });

  describe('state mutations', () => {
    it('should update started state', () => {
      chatStore.setKey('started', true);
      expect(chatStore.get().started).toBe(true);

      // Reset for other tests
      chatStore.setKey('started', false);
    });

    it('should update aborted state', () => {
      chatStore.setKey('aborted', true);
      expect(chatStore.get().aborted).toBe(true);

      // Reset for other tests
      chatStore.setKey('aborted', false);
    });

    it('should update showChat state', () => {
      chatStore.setKey('showChat', false);
      expect(chatStore.get().showChat).toBe(false);

      // Reset for other tests
      chatStore.setKey('showChat', true);
    });
  });

  describe('setPendingChatMessage', () => {
    it('should set pending message', () => {
      setPendingChatMessage('Hello from inspector');
      expect(chatStore.get().pendingMessage).toBe('Hello from inspector');

      // Cleanup
      clearPendingChatMessage();
    });

    it('should overwrite previous pending message', () => {
      setPendingChatMessage('First message');
      setPendingChatMessage('Second message');
      expect(chatStore.get().pendingMessage).toBe('Second message');

      // Cleanup
      clearPendingChatMessage();
    });

    it('should handle empty string', () => {
      setPendingChatMessage('');
      expect(chatStore.get().pendingMessage).toBe('');

      // Cleanup
      clearPendingChatMessage();
    });

    it('should handle long messages', () => {
      const longMessage = 'a'.repeat(10000);
      setPendingChatMessage(longMessage);
      expect(chatStore.get().pendingMessage).toBe(longMessage);

      // Cleanup
      clearPendingChatMessage();
    });
  });

  describe('clearPendingChatMessage', () => {
    it('should clear pending message', () => {
      setPendingChatMessage('Test message');
      clearPendingChatMessage();
      expect(chatStore.get().pendingMessage).toBeNull();
    });

    it('should be safe to call when no pending message', () => {
      clearPendingChatMessage();
      expect(chatStore.get().pendingMessage).toBeNull();
    });
  });

  describe('store reactivity', () => {
    it('should notify subscribers on state change', () => {
      let notified = false;
      const unsubscribe = chatStore.subscribe(() => {
        notified = true;
      });

      chatStore.setKey('started', true);
      expect(notified).toBe(true);

      // Cleanup
      unsubscribe();
      chatStore.setKey('started', false);
    });

    it('should provide current state to subscribers', () => {
      let receivedState: typeof chatStore extends { get: () => infer T } ? T : never;
      const unsubscribe = chatStore.subscribe((state) => {
        receivedState = state;
      });

      chatStore.setKey('aborted', true);
      expect(receivedState!.aborted).toBe(true);

      // Cleanup
      unsubscribe();
      chatStore.setKey('aborted', false);
    });
  });
});
