// server/memory/deps.js  (Owner: C)
// One place that imports B's models and constants.
// It works whether B used "export default Model" or "export const Model".
import * as MemoryMod from '../models/Memory.js';
import * as CodingAttemptMod from '../models/CodingAttempt.js';
import * as TopicMasteryMod from '../models/TopicMastery.js';
import * as ConstantsMod from '../constants.js';

export const Memory = MemoryMod.default || MemoryMod.Memory;
export const CodingAttempt = CodingAttemptMod.default || CodingAttemptMod.CodingAttempt;
export const TopicMastery = TopicMasteryMod.default || TopicMasteryMod.TopicMastery;

const C = ConstantsMod.default || ConstantsMod;
export const TOPICS = C.TOPICS;
export const ERROR_TYPES = C.ERROR_TYPES;