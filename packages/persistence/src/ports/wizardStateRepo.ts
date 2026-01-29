/**
 * Persistence interface for wizard state storage.
 */

export interface WizardStateRecord {
  instanceId: string;
  machineName: string;
  machineVersion: string;
  stateJson: string;
  expiresAt: number;
  updatedAt: number;
}

export interface WizardStateRepo {
  loadWizardState(instanceId: string): Promise<WizardStateRecord | null>;
  saveWizardState(record: WizardStateRecord): Promise<void>;
  deleteWizardState(instanceId: string): Promise<void>;
}
