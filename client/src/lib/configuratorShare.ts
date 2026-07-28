import type { ConfiguratorSlotState } from './ConfiguratorContext';

// Only encode fields that are meaningful to restore — skip runtime/pricing fields
type ShareableState = Pick<
  ConfiguratorSlotState,
  | 'vanId'
  | 'customVanDescription'
  | 'customVanValue'
  | 'vanReg'
  | 'serviceType'
  | 'kitId'
  | 'upgradeIds'
  | 'upgradeQuantities'
  | 'trainingOptionIds'
>;

export function encodeShareState(slot: ConfiguratorSlotState): string {
  const shareable: ShareableState = {
    vanId: slot.vanId,
    customVanDescription: slot.customVanDescription,
    customVanValue: slot.customVanValue,
    vanReg: slot.vanReg,
    serviceType: slot.serviceType,
    kitId: slot.kitId,
    upgradeIds: slot.upgradeIds,
    upgradeQuantities: slot.upgradeQuantities,
    trainingOptionIds: slot.trainingOptionIds,
  };
  return btoa(JSON.stringify(shareable));
}

export function decodeShareState(encoded: string): Partial<ShareableState> | null {
  try {
    const parsed = JSON.parse(atob(encoded));
    if (parsed && typeof parsed === 'object') return parsed as ShareableState;
    return null;
  } catch {
    return null;
  }
}

export function buildShareUrl(slot: ConfiguratorSlotState): string {
  const encoded = encodeShareState(slot);
  const { origin } = window.location;
  return `${origin}/configurator/van?cfg=${encoded}`;
}

export function hasAnythingSelected(slot: ConfiguratorSlotState): boolean {
  return !!(
    slot.vanId ||
    slot.customVanDescription ||
    slot.kitId ||
    slot.upgradeIds.length > 0 ||
    slot.serviceType
  );
}
