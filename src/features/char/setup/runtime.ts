import { createEngine } from '@discord-bot/state-machine';
import type { Engine } from '@discord-bot/state-machine';
import type { CharacterFeatureDeps } from '../repo/ports.js';
import type { Interaction } from 'discord.js';
import { wizardMachine } from './machine.js';
import type { WizardContext, WizardEvent, WizardState, WizardEffect } from './types.js';
import { WizardEffectRunner } from './effectsRunner.js';
import { WizardStateStorage } from './storage.js';

export class WizardRuntime {
  private readonly engine: Engine<WizardState, WizardEvent, WizardContext, WizardEffect>;
  private readonly contextMap = new Map<string, Interaction | undefined>();

  constructor(private readonly deps: CharacterFeatureDeps) {
    const storage = new WizardStateStorage(
      deps.wizardStateRepo,
      wizardMachine.catalog.machineName
    );
    const effectRunner = new WizardEffectRunner({
      client: deps.client,
      userRepo: deps.userRepo,
      characterRepo: deps.characterRepo,
      wizardStateRepo: deps.wizardStateRepo,
    });

    const createContext = (instanceId: string): WizardContext => ({
      instanceId,
      timestamp: new Date().toISOString(),
      interaction: this.contextMap.get(instanceId),
    });

    this.engine = createEngine(wizardMachine, {
      storage,
      effectRunner,
      createContext,
    });

    effectRunner.setEngineDispatch(async (id, event) => {
      await this.dispatch(id, event);
    });
  }

  async dispatch(
    instanceId: string,
    event: WizardEvent,
    interaction?: Interaction
  ) {
    this.contextMap.set(instanceId, interaction);
    const result = await this.engine.dispatch(instanceId, event);
    this.contextMap.delete(instanceId);
    return result;
  }

  async getState(instanceId: string): Promise<WizardState | null> {
    return this.engine.getState(instanceId);
  }

  async delete(instanceId: string): Promise<void> {
    await this.engine.delete(instanceId);
  }
}
