// server/memory/intent.js  (Owner: A)
// Pure function, no database. Decides whether a typed chat message is
// feedback on the previous AI answer ("I don't understand", "got it")
// or just a normal message / new question.
//
//   detectFeedbackIntent(message, hasPreviousAnswer)
//     -> "understood" | "not_understood" | null

const MAX_WORDS = 12;

// Lowercase, drop apostrophes ("don't" -> "dont"), turn other punctuation
// into spaces, collapse whitespace.
function normalise(text) {
  return String(text)
    .toLowerCase()
    .replace(/['‘’`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// "I don't understand", "dont get it", "can't follow", "never understood"
const NEG = '(?:dont|do not|didnt|did not|cant|cannot|can not|couldnt|could not|wont|doesnt|does not|havent|have not|never|still dont|still cant)';

const NOT_UNDERSTOOD = [
  new RegExp(`\\b${NEG}\\s+(?:really\\s+|quite\\s+|fully\\s+)?(?:understand|understood|get|got|follow|grasp|see|know what you mean)\\b`),
  // "not clear", "isn't clear", "not understood"
  /\b(?:not|isnt|arent|wasnt|still not)\s+(?:very\s+|really\s+|so\s+|that\s+)?(?:clear|understood)\b/,
  // "not sure I get it", "unsure I follow"
  /\b(?:not sure|unsure)\b.*\b(?:get|understand|follow|got)\b/,
  // "confused", "this is confusing"
  /\b(?:confused|confusing|confuses|puzzled|baffled)\b/,
  // "I'm lost", "im totally lost", "you lost me"
  /\b(?:im|i am|i feel|feeling|totally|completely|so|still)\s+(?:\w+\s+)?lost\b/,
  /\blost me\b/,
  // "makes no sense", "doesn't make sense"
  /\bmakes? no sense\b/,
  new RegExp(`\\b${NEG}\\s+make\\s+(?:any\\s+)?sense\\b`),
  /\bnot making sense\b/,
  // "explain differently", "say it again", "show it another way"
  /\b(?:explain|say|put|tell|show|teach)\s+(?:it|this|that|me)?\s*(?:again|differently|another way|a different way|in another way|in a different way|simpler|more simply|in simpler terms|better)\b/,
  /\btry\s+(?:another|a different|something else|a new)\b/,
  /\b(?:another|different)\s+(?:way|approach|explanation)\b/,
  /\b(?:simpler|more simply|in simple words)\b/,
  // "didn't follow", "went over my head", "too complicated"
  /\bover my head\b/,
  /\btoo (?:complicated|hard|difficult|complex|fast)\b/,
  // "that didn't help"
  /\b(?:doesnt|does not|didnt|did not|not|no)\s+(?:really\s+)?(?:help|helping|helpful)\b/,
  /\bunhelpful\b/,
  /^huh$/,
];

const UNDERSTOOD = [
  /\bgot it\b/,
  /\bgotcha\b/,
  /\bi get it\b/,
  /\b(?:now i see|i see now|oh i see|ah i see|i see what you mean)\b/,
  /\bunderstood\b/,
  /\bi understand\b/,
  /\bnow i understand\b/,
  /\bmakes? sense\b/,
  /\b(?:clear now|now clear|its clear|thats clear|crystal clear|all clear|clear enough|clearer now|much clearer)\b/,
  /\b(?:that helps|that helped|thats helpful|very helpful|really helpful|so helpful)\b/,
  /\bi (?:can )?follow(?: now)?\b/,
  /\b(?:aha|eureka)\b/,
];

// A new question, not feedback. Checked only after the not_understood patterns,
// because "explain differently" starts with "explain" but is feedback.
const NEW_TOPIC = /\b(?:explain|teach me|what is|whats|what are|what does|how does|how do|how to|tell me about|show me)\b/;

export function detectFeedbackIntent(message, hasPreviousAnswer) {
  if (!hasPreviousAnswer) return null;
  if (typeof message !== 'string') return null;

  const words = message.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > MAX_WORDS) return null;

  const text = normalise(message);
  if (!text) return null;

  // Negatives first: "I don't understand" contains "understand",
  // "not clear" contains "clear".
  if (NOT_UNDERSTOOD.some((re) => re.test(text))) return 'not_understood';

  if (NEW_TOPIC.test(text)) return null;

  // "makes sense?" is a question, not a confirmation.
  if (message.includes('?')) return null;

  if (UNDERSTOOD.some((re) => re.test(text))) return 'understood';

  return null;
}

export default detectFeedbackIntent;
