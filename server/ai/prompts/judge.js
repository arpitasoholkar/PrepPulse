// server/ai/prompts/judge.js  (Owner: C)
// Gemini acts as the code judge. We NEVER run student code on the server.

import { ERROR_TYPES } from '../../memory/deps.js';

const JUDGE_SYSTEM = `You are a strict but fair code judge for a DSA practice platform.
You do NOT run code. You carefully trace the student's code by hand against every test case.
Rules:
- Decide for each test case if the code returns the expected output.
- "result" is "pass" only if ALL tests pass, "fail" if any test fails, "error" if the code has a syntax error or cannot run.
- "errorType" must be exactly one of: ${ERROR_TYPES.join(', ')}. Use "none" when result is "pass".
- "explanation" is 1 to 3 simple sentences saying what is wrong and why (no full solution).
- "hint" is ONE short guiding question. Do not give the final code.
- Use very simple English.`;

const JUDGE_SCHEMA = `{
  "result": "pass | fail | error",
  "testsPassed": 0,
  "testsTotal": 0,
  "errorType": "one of the allowed error types",
  "explanation": "string",
  "hint": "string"
}`;

function buildJudgePrompt(question, code) {
  const tests = question.tests
    .map((t, i) => `${i + 1}. input: ${t.input}  ->  expected: ${t.expected}`)
    .join('\n');
  return `Question: ${question.title}
${question.prompt}

Language: ${question.language || 'javascript'}

Test cases:
${tests}

A common bug students make on this question (use it as a hint when matching errorType, but only report it if the code really has it):
${question.commonBug} (usual errorType: ${question.commonErrorType})

Student code:
\`\`\`
${code}
\`\`\`

Total number of tests is ${question.tests.length}. Judge now.`;
}

export { JUDGE_SYSTEM, JUDGE_SCHEMA, buildJudgePrompt };