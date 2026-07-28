import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { KitServiceType, Upgrade } from '@shared/schema';

export interface ConfiguratorSlotState {
  vanId: string | null;
  customVanDescription: string | null;
  customVanValue: number | null; // in pence
  vanReg: string | null;
  serviceType: KitServiceType | null;
  kitId: string | null;
  upgradeIds: string[];
  upgradeQuantities: Record<string, number>;
  trainingOptionIds: string[];
  financePlanId: string | null;
  financeInputs: {
    deposit?: number;
    term?: number;
    balloon?: number;
    vatDeferredRequested?: boolean;
  } | null;
  pricingSnapshot: {
    subtotal: number;
    vat: number;
    total: number;
  } | null;
}

// Legacy alias for backwards compatibility
export type ConfiguratorState = ConfiguratorSlotState;

interface ConfiguratorContextValue {
  state: ConfiguratorSlotState; // always reflects the active slot
  slotA: ConfiguratorSlotState;
  slotB: ConfiguratorSlotState;
  compareMode: boolean;
  activeSlot: 'A' | 'B';
  enableCompareMode: () => void;
  setActiveSlot: (slot: 'A' | 'B') => void;
  clearSlotA: () => void;
  clearSlotB: () => void;
  setVan: (vanId: string | null) => void;
  setVanOnly: (vanId: string | null) => void;
  setServiceTypeOnly: (serviceType: KitServiceType | null) => void;
  setKitOnly: (kitId: string | null) => void;
  setCustomVan: (description: string, valueInPence: number) => void;
  setCustomVanValue: (valueInPence: number | null) => void;
  setVanReg: (reg: string | null) => void;
  setServiceType: (serviceType: KitServiceType | null) => void;
  setKit: (kitId: string | null) => void;
  setUpgrades: (upgradeIds: string[]) => void;
  addUpgrade: (upgradeId: string) => void;
  removeUpgrade: (upgradeId: string) => void;
  replaceUpgrades: (toRemove: string[], toAdd: string) => void;
  setUpgradeQuantity: (upgradeId: string, quantity: number) => void;
  purgeUpgradeQuantities: (upgradeIds: string[]) => void;
  setTrainingOptions: (trainingOptionIds: string[]) => void;
  addTrainingOption: (trainingOptionId: string) => void;
  removeTrainingOption: (trainingOptionId: string) => void;
  setFinancePlan: (financePlanId: string | null) => void;
  setFinanceInputs: (inputs: ConfiguratorSlotState['financeInputs']) => void;
  setPricingSnapshot: (pricing: ConfiguratorSlotState['pricingSnapshot']) => void;
  clearAll: () => void;
  resetFromVan: () => void;
  resetFromServiceType: () => void;
  resetFromKit: () => void;
  resetFromUpgrades: () => void;
  resetFromFinance: () => void;
}

const STORAGE_KEY = 'configurator:v6';

const defaultSlotState: ConfiguratorSlotState = {
  vanId: null,
  customVanDescription: null,
  customVanValue: null,
  vanReg: null,
  serviceType: null,
  kitId: null,
  upgradeIds: [],
  upgradeQuantities: {},
  trainingOptionIds: [],
  financePlanId: null,
  financeInputs: null,
  pricingSnapshot: null,
};

interface FullState {
  slotA: ConfiguratorSlotState;
  slotB: ConfiguratorSlotState;
  compareMode: boolean;
  activeSlot: 'A' | 'B';
}

const defaultFullState: FullState = {
  slotA: defaultSlotState,
  slotB: defaultSlotState,
  compareMode: false,
  activeSlot: 'A',
};

const ConfiguratorContext = createContext<ConfiguratorContextValue | undefined>(undefined);

export function ConfiguratorProvider({ children }: { children: ReactNode }) {
  // Fetch the upgrade catalog independently so the context can self-resolve
  // exclusive-group conflicts without relying on any page-level registration.
  const { data: upgradesData } = useQuery<Upgrade[]>({ queryKey: ['/api/upgrades'] });
  const upgradeCatalog = upgradesData ?? null;

  const [fullState, setFullState] = useState<FullState>(() => {
    if (typeof window === 'undefined') return defaultFullState;

    // Share link (?cfg=...) takes priority over localStorage
    try {
      const cfgParam = new URLSearchParams(window.location.search).get('cfg');
      if (cfgParam) {
        const shared = JSON.parse(atob(cfgParam));
        if (shared && typeof shared === 'object') {
          // Clean the param from the URL without triggering a reload
          const cleanUrl = window.location.pathname;
          window.history.replaceState(null, '', cleanUrl);
          return {
            ...defaultFullState,
            slotA: { ...defaultSlotState, ...shared },
          };
        }
      }
    } catch {
      // Malformed share param — fall through to localStorage
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...defaultFullState,
          slotA: { ...defaultSlotState, ...(parsed.slotA || parsed) },
          slotB: { ...defaultSlotState, ...(parsed.slotB || {}) },
          compareMode: parsed.compareMode ?? false,
          activeSlot: parsed.activeSlot ?? 'A',
        };
      }
      // Try upgrading from old v5 key (add upgradeQuantities with empty default)
      const v5Stored = localStorage.getItem('configurator:v5');
      if (v5Stored) {
        const parsed = JSON.parse(v5Stored);
        return {
          ...defaultFullState,
          slotA: { ...defaultSlotState, ...(parsed.slotA || parsed), upgradeQuantities: {} },
          slotB: { ...defaultSlotState, ...(parsed.slotB || {}), upgradeQuantities: {} },
          compareMode: parsed.compareMode ?? false,
          activeSlot: parsed.activeSlot ?? 'A',
        };
      }
      // Try upgrading from old v4 key
      const oldStored = localStorage.getItem('configurator:v4');
      if (oldStored) {
        const parsed = JSON.parse(oldStored);
        return {
          ...defaultFullState,
          slotA: { ...defaultSlotState, ...parsed, upgradeQuantities: {} },
        };
      }
    } catch (error) {
      console.error('Failed to load configurator state:', error);
    }
    return defaultFullState;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullState));
    } catch (error) {
      console.error('Failed to save configurator state:', error);
    }
  }, [fullState]);

  // Internal effect: once the upgrade catalog is registered, resolve any exclusive-group
  // conflicts that arrived via stale localStorage or loaded quote data.
  // This runs exactly once per catalog registration — before any user interaction.
  useEffect(() => {
    if (!upgradeCatalog) return;

    const getExclusiveGroup = (upgrade: Upgrade): string | null => {
      if (upgrade.exclusiveGroup) return upgrade.exclusiveGroup;
      if (upgrade.parentId) {
        const parent = upgradeCatalog.find(u => u.id === upgrade.parentId);
        if (parent?.exclusiveGroup) return parent.exclusiveGroup;
      }
      return null;
    };

    const resolveSlot = (slot: ConfiguratorSlotState): ConfiguratorSlotState => {
      const selected = upgradeCatalog.filter(u => slot.upgradeIds.includes(u.id));
      const groupMap = new Map<string, string[]>();
      selected.forEach(u => {
        const group = getExclusiveGroup(u);
        if (group) {
          if (!groupMap.has(group)) groupMap.set(group, []);
          groupMap.get(group)!.push(u.id);
        }
      });

      const toRemove: string[] = [];
      groupMap.forEach(ids => {
        if (ids.length > 1) {
          const [, ...rest] = ids;
          toRemove.push(...rest);
        }
      });

      if (toRemove.length === 0) return slot;

      const nextQuantities = { ...slot.upgradeQuantities };
      toRemove.forEach(id => delete nextQuantities[id]);
      return {
        ...slot,
        upgradeIds: slot.upgradeIds.filter(id => !toRemove.includes(id)),
        upgradeQuantities: nextQuantities,
      };
    };

    setFullState(prev => {
      const nextSlotA = resolveSlot(prev.slotA);
      const nextSlotB = resolveSlot(prev.slotB);
      if (nextSlotA === prev.slotA && nextSlotB === prev.slotB) return prev;
      return { ...prev, slotA: nextSlotA, slotB: nextSlotB };
    });
  }, [upgradeCatalog]);

  // Helper to update the currently active slot
  const updateActiveSlot = (updater: (prev: ConfiguratorSlotState) => ConfiguratorSlotState) => {
    setFullState(prev => {
      if (prev.activeSlot === 'A') {
        return { ...prev, slotA: updater(prev.slotA) };
      } else {
        return { ...prev, slotB: updater(prev.slotB) };
      }
    });
  };

  const enableCompareMode = () => {
    setFullState(prev => ({
      ...prev,
      compareMode: true,
      // Slot B inherits the full config from slot A — only the van will differ
      slotB: {
        ...prev.slotA,
        vanId: null,
        customVanDescription: null,
        customVanValue: null,
        vanReg: null,
      },
      activeSlot: 'B',
    }));
  };

  const setActiveSlot = (slot: 'A' | 'B') => {
    setFullState(prev => ({ ...prev, activeSlot: slot }));
  };

  const clearSlotA = () => {
    // Resets slot A config back to default while keeping compare mode active
    setFullState(prev => ({
      ...prev,
      slotA: defaultSlotState,
      activeSlot: 'A',
    }));
  };

  const clearSlotB = () => {
    setFullState(prev => ({
      ...prev,
      compareMode: false,
      slotB: defaultSlotState,
      activeSlot: 'A',
    }));
  };

  const setVan = (vanId: string | null) => {
    setFullState(prev => {
      // In compare mode, slot B only changes the van — config (kit/upgrades) is shared with slot A
      if (prev.compareMode && prev.activeSlot === 'B') {
        return {
          ...prev,
          slotB: {
            ...prev.slotB,
            vanId,
            customVanDescription: null,
            customVanValue: null,
            vanReg: null,
          },
        };
      }
      // Normal mode: update active slot and reset all downstream selections
      const slot = prev.activeSlot === 'A' ? 'slotA' : 'slotB';
      return {
        ...prev,
        [slot]: {
          ...prev[slot],
          vanId,
          customVanDescription: null,
          customVanValue: null,
          serviceType: null,
          kitId: null,
          upgradeIds: [],
          upgradeQuantities: {},
          trainingOptionIds: [],
          financePlanId: null,
          financeInputs: null,
          pricingSnapshot: null,
        },
      };
    });
  };

  // Admin-only: change service type without clearing kit or upgrades
  const setServiceTypeOnly = (serviceType: KitServiceType | null) => {
    if (isLockedSlotB()) return;
    setFullState(prev => {
      const slot = prev.activeSlot === 'A' ? 'slotA' : 'slotB';
      const updated = {
        ...prev,
        [slot]: { ...prev[slot], serviceType },
      };
      return syncSlotBFromA(updated);
    });
  };

  // Admin-only: change kit without clearing upgrades
  const setKitOnly = (kitId: string | null) => {
    if (isLockedSlotB()) return;
    setFullState(prev => {
      const slot = prev.activeSlot === 'A' ? 'slotA' : 'slotB';
      const updated = {
        ...prev,
        [slot]: { ...prev[slot], kitId },
      };
      return syncSlotBFromA(updated);
    });
  };

  // Admin-only: swap just the van without clearing kit, service type, or upgrades
  const setVanOnly = (vanId: string | null) => {
    setFullState(prev => {
      const slot = prev.activeSlot === 'A' ? 'slotA' : 'slotB';
      return {
        ...prev,
        [slot]: {
          ...prev[slot],
          vanId,
          customVanDescription: null,
          customVanValue: null,
          vanReg: null,
        },
      };
    });
  };

  const setCustomVan = (description: string, valueInPence: number) => {
    setFullState(prev => {
      // In compare mode, slot B only changes the van
      if (prev.compareMode && prev.activeSlot === 'B') {
        return {
          ...prev,
          slotB: {
            ...prev.slotB,
            vanId: null,
            customVanDescription: description,
            customVanValue: valueInPence,
          },
        };
      }
      const slot = prev.activeSlot === 'A' ? 'slotA' : 'slotB';
      return {
        ...prev,
        [slot]: {
          ...prev[slot],
          vanId: null,
          customVanDescription: description,
          customVanValue: valueInPence,
          serviceType: null,
          kitId: null,
          upgradeIds: [],
          upgradeQuantities: {},
          trainingOptionIds: [],
          financePlanId: null,
          financeInputs: null,
          pricingSnapshot: null,
        },
      };
    });
  };

  const setCustomVanValue = (valueInPence: number | null) => {
    updateActiveSlot(prev => ({ ...prev, customVanValue: valueInPence }));
  };

  const setVanReg = (reg: string | null) => {
    updateActiveSlot(prev => ({ ...prev, vanReg: reg }));
  };

  // In compare mode, slot B shares the kit/upgrades/training from slot A — only the van differs.
  // These helpers return early when slot B is active so nothing can accidentally diverge.
  const isLockedSlotB = () =>
    fullState.compareMode && fullState.activeSlot === 'B';

  // Syncs slot B config fields from slot A when in compare mode.
  // Called after any slot A change that slot B must mirror.
  const syncSlotBFromA = (prev: typeof fullState): typeof fullState => {
    if (!prev.compareMode) return prev;
    return {
      ...prev,
      slotB: {
        ...prev.slotB,
        serviceType: prev.slotA.serviceType,
        kitId: prev.slotA.kitId,
        upgradeIds: [...prev.slotA.upgradeIds],
        upgradeQuantities: { ...prev.slotA.upgradeQuantities },
        trainingOptionIds: [...prev.slotA.trainingOptionIds],
      },
    };
  };

  const setServiceType = (serviceType: KitServiceType | null) => {
    if (isLockedSlotB()) return;
    setFullState(prev => {
      const slot = prev.activeSlot === 'A' ? 'slotA' : 'slotB';
      const updated = {
        ...prev,
        [slot]: {
          ...prev[slot],
          serviceType,
          kitId: null,
          upgradeIds: [],
          upgradeQuantities: {},
          trainingOptionIds: [],
          financePlanId: null,
          financeInputs: null,
          pricingSnapshot: null,
        },
      };
      return syncSlotBFromA(updated);
    });
  };

  const setKit = (kitId: string | null) => {
    if (isLockedSlotB()) return;
    setFullState(prev => {
      const slot = prev.activeSlot === 'A' ? 'slotA' : 'slotB';
      const updated = {
        ...prev,
        [slot]: {
          ...prev[slot],
          kitId,
          upgradeIds: [],
          upgradeQuantities: {},
          trainingOptionIds: [],
          financePlanId: null,
          financeInputs: null,
          pricingSnapshot: null,
        },
      };
      return syncSlotBFromA(updated);
    });
  };

  const setUpgradeQuantity = (upgradeId: string, quantity: number) => {
    setFullState(prev => {
      const slot = prev.compareMode ? 'slotA' : (prev.activeSlot === 'A' ? 'slotA' : 'slotB');
      const updated = {
        ...prev,
        [slot]: {
          ...prev[slot],
          upgradeQuantities: { ...prev[slot].upgradeQuantities, [upgradeId]: quantity },
        },
      };
      return syncSlotBFromA(updated);
    });
  };

  const purgeUpgradeQuantities = (upgradeIds: string[]) => {
    if (upgradeIds.length === 0) return;
    setFullState(prev => {
      const slot = prev.compareMode ? 'slotA' : (prev.activeSlot === 'A' ? 'slotA' : 'slotB');
      const next = { ...prev[slot].upgradeQuantities };
      upgradeIds.forEach(id => delete next[id]);
      const updated = { ...prev, [slot]: { ...prev[slot], upgradeQuantities: next } };
      return syncSlotBFromA(updated);
    });
  };

  const setUpgrades = (upgradeIds: string[]) => {
    setFullState(prev => {
      const slot = prev.compareMode ? 'slotA' : (prev.activeSlot === 'A' ? 'slotA' : 'slotB');
      const updated = { ...prev, [slot]: { ...prev[slot], upgradeIds } };
      return syncSlotBFromA(updated);
    });
  };

  const addUpgrade = (upgradeId: string) => {
    setFullState(prev => {
      // Upgrades are always shared from slotA in compare mode
      const slot = prev.compareMode ? 'slotA' : (prev.activeSlot === 'A' ? 'slotA' : 'slotB');
      if (prev[slot].upgradeIds.includes(upgradeId)) return prev;
      const updated = { ...prev, [slot]: { ...prev[slot], upgradeIds: [...prev[slot].upgradeIds, upgradeId] } };
      return syncSlotBFromA(updated);
    });
  };

  const removeUpgrade = (upgradeId: string) => {
    setFullState(prev => {
      // Upgrades are always shared from slotA in compare mode
      const slot = prev.compareMode ? 'slotA' : (prev.activeSlot === 'A' ? 'slotA' : 'slotB');
      const nextQuantities = { ...prev[slot].upgradeQuantities };
      delete nextQuantities[upgradeId];
      const updated = {
        ...prev,
        [slot]: {
          ...prev[slot],
          upgradeIds: prev[slot].upgradeIds.filter(id => id !== upgradeId),
          upgradeQuantities: nextQuantities,
        },
      };
      return syncSlotBFromA(updated);
    });
  };

  const replaceUpgrades = (toRemove: string[], toAdd: string) => {
    setFullState(prev => {
      // Upgrades are always shared from slotA in compare mode
      const slot = prev.compareMode ? 'slotA' : (prev.activeSlot === 'A' ? 'slotA' : 'slotB');
      let newUpgradeIds = prev[slot].upgradeIds.filter(id => !toRemove.includes(id));
      if (!newUpgradeIds.includes(toAdd)) newUpgradeIds = [...newUpgradeIds, toAdd];
      const nextQuantities = { ...prev[slot].upgradeQuantities };
      toRemove.forEach(id => delete nextQuantities[id]);
      const updated = {
        ...prev,
        [slot]: { ...prev[slot], upgradeIds: newUpgradeIds, upgradeQuantities: nextQuantities },
      };
      return syncSlotBFromA(updated);
    });
  };

  const setTrainingOptions = (trainingOptionIds: string[]) => {
    if (isLockedSlotB()) return;
    setFullState(prev => {
      const slot = prev.activeSlot === 'A' ? 'slotA' : 'slotB';
      const updated = { ...prev, [slot]: { ...prev[slot], trainingOptionIds } };
      return syncSlotBFromA(updated);
    });
  };

  const addTrainingOption = (trainingOptionId: string) => {
    if (isLockedSlotB()) return;
    setFullState(prev => {
      const slot = prev.activeSlot === 'A' ? 'slotA' : 'slotB';
      if (prev[slot].trainingOptionIds.includes(trainingOptionId)) return prev;
      const updated = { ...prev, [slot]: { ...prev[slot], trainingOptionIds: [...prev[slot].trainingOptionIds, trainingOptionId] } };
      return syncSlotBFromA(updated);
    });
  };

  const removeTrainingOption = (trainingOptionId: string) => {
    if (isLockedSlotB()) return;
    setFullState(prev => {
      const slot = prev.activeSlot === 'A' ? 'slotA' : 'slotB';
      const updated = { ...prev, [slot]: { ...prev[slot], trainingOptionIds: prev[slot].trainingOptionIds.filter(id => id !== trainingOptionId) } };
      return syncSlotBFromA(updated);
    });
  };

  const setFinancePlan = (financePlanId: string | null) => {
    updateActiveSlot(prev => ({
      ...prev,
      financePlanId,
      financeInputs: null,
      pricingSnapshot: null,
    }));
  };

  const setFinanceInputs = (financeInputs: ConfiguratorSlotState['financeInputs']) => {
    updateActiveSlot(prev => ({ ...prev, financeInputs }));
  };

  const setPricingSnapshot = (pricingSnapshot: ConfiguratorSlotState['pricingSnapshot']) => {
    updateActiveSlot(prev => ({ ...prev, pricingSnapshot }));
  };

  const clearAll = () => {
    setFullState(defaultFullState);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear configurator state:', error);
    }
  };

  const resetFromVan = () => {
    if (isLockedSlotB()) {
      // In compare mode, slot B only has a van — reset just the van fields, leave kit/upgrades intact
      updateActiveSlot(prev => ({
        ...prev,
        vanId: null,
        customVanDescription: null,
        customVanValue: null,
        vanReg: null,
      }));
      return;
    }
    updateActiveSlot(prev => ({
      ...prev,
      customVanDescription: null,
      customVanValue: null,
      vanReg: null,
      serviceType: null,
      kitId: null,
      upgradeIds: [],
      upgradeQuantities: {},
      trainingOptionIds: [],
      financePlanId: null,
      financeInputs: null,
      pricingSnapshot: null,
    }));
  };

  const resetFromServiceType = () => {
    if (isLockedSlotB()) return;
    updateActiveSlot(prev => ({
      ...prev,
      kitId: null,
      upgradeIds: [],
      upgradeQuantities: {},
      trainingOptionIds: [],
      financePlanId: null,
      financeInputs: null,
      pricingSnapshot: null,
    }));
  };

  const resetFromKit = () => {
    if (isLockedSlotB()) return;
    updateActiveSlot(prev => ({
      ...prev,
      upgradeIds: [],
      upgradeQuantities: {},
      trainingOptionIds: [],
      financePlanId: null,
      financeInputs: null,
      pricingSnapshot: null,
    }));
  };

  const resetFromUpgrades = () => {
    if (isLockedSlotB()) return;
    updateActiveSlot(prev => ({
      ...prev,
      trainingOptionIds: [],
      financePlanId: null,
      financeInputs: null,
      pricingSnapshot: null,
    }));
  };

  const resetFromFinance = () => {
    updateActiveSlot(prev => ({
      ...prev,
      pricingSnapshot: null,
    }));
  };


  const activeSlotState = fullState.activeSlot === 'A' ? fullState.slotA : fullState.slotB;

  const value: ConfiguratorContextValue = {
    state: activeSlotState,
    slotA: fullState.slotA,
    slotB: fullState.slotB,
    compareMode: fullState.compareMode,
    activeSlot: fullState.activeSlot,
    enableCompareMode,
    setActiveSlot,
    clearSlotA,
    clearSlotB,
    setVan,
    setVanOnly,
    setServiceTypeOnly,
    setKitOnly,
    setCustomVan,
    setCustomVanValue,
    setVanReg,
    setServiceType,
    setKit,
    setUpgrades,
    addUpgrade,
    removeUpgrade,
    replaceUpgrades,
    setUpgradeQuantity,
    purgeUpgradeQuantities,
    setTrainingOptions,
    addTrainingOption,
    removeTrainingOption,
    setFinancePlan,
    setFinanceInputs,
    setPricingSnapshot,
    clearAll,
    resetFromVan,
    resetFromServiceType,
    resetFromKit,
    resetFromUpgrades,
    resetFromFinance,
  };

  return (
    <ConfiguratorContext.Provider value={value}>
      {children}
    </ConfiguratorContext.Provider>
  );
}

export function useConfigurator() {
  const context = useContext(ConfiguratorContext);
  if (!context) {
    throw new Error('useConfigurator must be used within ConfiguratorProvider');
  }
  return context;
}
