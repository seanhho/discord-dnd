/**
 * Storage adapter interface for state persistence.
 */

import type { BaseState, StoredState, StateMeta } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Storage Adapter Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interface for state persistence.
 * Implement this to store machine state in your preferred backend.
 */
export interface StorageAdapter<S extends BaseState> {
  /**
   * Load state for an instance.
   * @returns The stored state with metadata, or null if not found.
   */
  load(instanceId: string): Promise<StoredState<S> | null>;

  /**
   * Save state for an instance.
   * @param instanceId - Unique identifier for the machine instance
   * @param state - The state to persist
   * @param meta - Metadata to store alongside state
   */
  save(instanceId: string, state: S, meta: StateMeta): Promise<void>;

  /**
   * Delete state for an instance.
   * Optional - not all storage backends need to support this.
   */
  delete?(instanceId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Storage (for testing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple in-memory storage adapter for testing.
 */
export class InMemoryStorage<S extends BaseState> implements StorageAdapter<S> {
  private store = new Map<string, StoredState<S>>();

  async load(instanceId: string): Promise<StoredState<S> | null> {
    return this.store.get(instanceId) ?? null;
  }

  async save(instanceId: string, state: S, meta: StateMeta): Promise<void> {
    this.store.set(instanceId, { state, meta });
  }

  async delete(instanceId: string): Promise<void> {
    this.store.delete(instanceId);
  }

  /**
   * Get all stored instances (for testing).
   */
  getAll(): Map<string, StoredState<S>> {
    return new Map(this.store);
  }

  /**
   * Clear all stored state (for testing).
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get the number of stored instances (for testing).
   */
  get size(): number {
    return this.store.size;
  }
}
