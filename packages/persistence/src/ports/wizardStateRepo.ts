/**
 * Wizard State Repository Port
 *
 * Interface for persisting wizard/machine state.
 * Used by state machines that need to survive restarts.
 */

/**
 * Stored wizard state with metadata.
 */
export interface WizardState {
  /** Unique identifier for this wizard instance */
  instanceId: string;
  /** Machine name (e.g., "char-setup") */
  machineName: string;
  /** Machine version for migration support */
  machineVersion: string;
  /** JSON-serialized state */
  stateJson: string;
  /** Expiration timestamp (Unix ms) */
  expiresAt: number;
  /** Last update timestamp (Unix ms) */
  updatedAt: number;
}

/**
 * Parameters for saving wizard state.
 */
export interface SaveWizardStateParams {
  instanceId: string;
  machineName: string;
  machineVersion: string;
  stateJson: string;
  expiresAt: number;
}

/**
 * Repository interface for wizard state persistence.
 */
export interface WizardStateRepo {
  /**
   * Load wizard state by instance ID.
   * Returns null if not found or expired.
   */
  load(instanceId: string): Promise<WizardState | null>;

  /**
   * Save or update wizard state.
   */
  save(params: SaveWizardStateParams): Promise<void>;

  /**
   * Delete wizard state by instance ID.
   */
  delete(instanceId: string): Promise<void>;

  /**
   * Delete all expired wizard states.
   * Returns the number of deleted states.
   */
  deleteExpired(): Promise<number>;

  /**
   * List all wizard states for a machine (for debugging/admin).
   */
  listByMachine(machineName: string): Promise<WizardState[]>;
}
