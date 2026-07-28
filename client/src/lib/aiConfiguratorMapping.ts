/**
 * AI Configurator Mapping Config
 * 
 * This is the single source of truth for mapping AI chat outputs to
 * the existing configurator's field IDs and option values.
 * 
 * Update this file if configurator fields ever change — no AI logic changes needed.
 */

export const AI_CHAT_STORAGE_KEY = "ai-chat:v1";
export const CONFIGURATOR_STORAGE_KEY = "configurator:v6";

export type ServiceType = "car" | "commercial" | "hybrid";
export type VanSize = "MWB" | "LWB";
export type FinancePreference = "outright" | "lease" | "finance";
export type DailyJobVolume = "high" | "standard";
export type Stage = "chat" | "summary" | "complete";
export type FortyEightVResponse = "yes" | "objection" | "soft_no" | "hard_no" | null;

/**
 * The configuration object the AI builds progressively during the conversation.
 * All IDs must map to real database records.
 */
export interface AIConfig {
  ownVan: boolean | null;
  vanSize: VanSize | null;
  serviceType: ServiceType | null;
  isEuro6: boolean | null;
  dailyJobVolume: DailyJobVolume | null;
  machineType: "semi-auto" | "fully-auto" | null;
  packageId: "bronze" | "silver" | "gold" | null;
  kitId: string | null;
  upgradeIds: string[];
  financePlanId: string | null;
  financePreference: FinancePreference | null;
  includes48v: boolean;
  contactName: string | null;
  contactPhone: string | null;
}

export interface AITrackers {
  was48vPitched: boolean;
  responseToThis48v: FortyEightVResponse;
  suggestedUpgradeIds: string[];
  addedUpgradeIds: string[];
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIChatState {
  sessionId: string;
  messages: AIMessage[];
  config: AIConfig;
  stage: Stage;
  trackers: AITrackers;
  savedAt: string;
}

export interface AIMessageResponse {
  message: string;
  config: AIConfig;
  stage: Stage;
  trackers: AITrackers;
}

export const defaultConfig: AIConfig = {
  ownVan: null,
  vanSize: null,
  serviceType: null,
  isEuro6: null,
  dailyJobVolume: null,
  machineType: null,
  packageId: null,
  kitId: null,
  upgradeIds: [],
  financePlanId: null,
  financePreference: null,
  includes48v: false,
  contactName: null,
  contactPhone: null,
};

export const defaultTrackers: AITrackers = {
  was48vPitched: false,
  responseToThis48v: null,
  suggestedUpgradeIds: [],
  addedUpgradeIds: [],
};

/**
 * Converts an AI-generated config into the configurator's localStorage format (configurator:v6).
 * Call this when the customer clicks "View your configuration →".
 */
export function buildConfiguratorState(config: AIConfig) {
  const defaultSlot = {
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

  let customVanDescription: string | null = null;
  if (config.ownVan === false && config.vanSize) {
    customVanDescription = `${config.vanSize} van supplied by Mobile Tyre Vans`;
  } else if (config.ownVan === true) {
    customVanDescription = "Customer's own van";
  }

  const slotA = {
    ...defaultSlot,
    customVanDescription,
    serviceType: config.serviceType,
    kitId: config.kitId,
    upgradeIds: config.upgradeIds,
    financePlanId: config.financePlanId,
  };

  return {
    slotA,
    slotB: defaultSlot,
    compareMode: false,
    activeSlot: "A",
  };
}

/**
 * Generates a unique session ID for a new AI chat conversation.
 */
export function generateSessionId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
