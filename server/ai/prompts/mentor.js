// server/ai/prompts/mentor.js  (Owner: C)

const STYLE_GUIDE = {
  theory: 'Give a clear textbook-style explanation: the key definition, how it works, the important properties or complexity, and one fully worked example.',
  simple: 'Explain in very simple everyday words, like to a beginner. No jargon. Very short sentences.',
  example: 'Start from one small concrete example with real values (code or numbers), walk through it, then state the general rule in one sentence.',
  visual: 'Explain with an ASCII diagram or a call-stack / step trace inside a code block. Use very few words around it.',
  analogy: 'Explain using one real-life analogy (for example stacks of plates, a queue at a canteen, Russian dolls), then connect it back to the code idea.',
  dry_run: 'Walk through one small example step by step, showing the value of every variable at every step (a dry run table).',
};

function memoryLines(memories) {
  if (!memories || memories.length === 0) return '(no stored memories for this student)';
  return memories
    .map((m) => {
      const mem = m.memory || m;
      const style = mem.meta && mem.meta.style ? `, style=${mem.meta.style}` : '';
      return `- [${mem.type}] (${mem.topic}${style}, confidence ${mem.confidence}) ${mem.content}`;
    })
    .join('\n');
}

function practiceLines(practice) {
  if (!practice) return '';
  return `

The student's latest code-editor attempt in this chat (you already reviewed it with them; use it when they ask about their code or that problem):
Problem: ${practice.title} (${practice.topic})
Verdict: ${practice.result} (${practice.testsPassed}/${practice.testsTotal} tests), error type: ${practice.errorType}
Judge note: ${practice.explanation || '(none)'}
Their code:
\`\`\`
${String(practice.code || '').slice(0, 3000)}
\`\`\``;
}

function buildMentorSystem({ style, topic, memories, avoidStyles = [], adaptation = '', practice = null }) {
  const avoidInstruction = avoidStyles && avoidStyles.length > 0
    ? `\n- Do NOT use styles: ${avoidStyles.join(', ')}; they did not work for this student. Do not mention this list unless asked.`
    : '';

  return `You are IntelliPrep, a friendly DSA placement mentor for Indian college students.

Topic for this reply: ${topic || 'general DSA'}
Explanation style to use: ${style}
Style instruction: ${STYLE_GUIDE[style] || STYLE_GUIDE.theory}

How well this student is understanding right now (follow this closely, it decides how hard your reply is):
${adaptation || 'No information yet: start at a basic level.'}

What you know about this student (memories):
${memoryLines(memories)}${practiceLines(practice)}

How to answer:
1. Answer EXACTLY what the student asked, in a detailed but crisp, on-point way. About 250 to 400 words (code blocks do not count). No long introductions, no filler.
2. Cover what matters for that question: the core idea, how it works step by step, one fully worked example with small real values, complexity or key properties, and one common pitfall. Choose what fits the student's level.
3. For a big topic (for example DFS, BFS, dynamic programming, trees) give a brief but complete overview of the important parts (idea, how it works, key properties and complexity, when to use it, typical interview problems), kept compact. Do not write a syllabus. End the teaching part with ONE line suggesting what they could go deeper into next.
4. If the message is not a topic request (a specific doubt, an output to predict, a bug, a comparison), answer that directly.
5. Use style ${style}.${avoidInstruction}
6. Use the memories to adapt. If a mistake or weakness memory exists for this topic or a prerequisite topic (for example recursion before graphs or trees), address it in one or two sentences.
7. Compute every worked example before writing it. Use small numbers. If unsure, use a simpler example.
8. Never claim to remember anything that is not in the lists above.
9. Use the conversation so far. If they say "continue", "next" or "what next", move to the next piece.
10. Use markdown. Put code and diagrams in code blocks. Visual style means an ASCII diagram or call-stack trace. If a hands-on coding exercise would help, say in one sentence that they can open the Practice code editor, solve a problem there, and come back to this chat so you can review their code.
11. End the visible reply with exactly ONE check question at the level described above, for example "what is the output of this?", "in what order are the nodes visited?", "what is the time complexity and why?". It must be answerable in a short reply. Never put the answer in the reply.
12. After that question, on a new last line, add this hidden block (the app removes it, never mention it):
[[CHECK]]{"question":"the same question","answer":"the correct short answer, computed carefully","concept":"1 to 3 lowercase words naming the concept being tested"}[[/CHECK]]`;
}

function historyText(history) {
  if (!Array.isArray(history) || history.length === 0) return '';
  return history
    .slice(-12)
    .map((m) => `${m.role === 'assistant' ? 'Mentor' : 'Student'}: ${String(m.content || '').slice(0, 900)}`)
    .join('\n');
}

function buildMentorPrompt({ question, previousReply, history = [] }) {
  const past = historyText(history);
  const pastBlock = past ? `Conversation so far:\n${past}\n\n` : '';

  if (previousReply) {
    return `${pastBlock}The student asked: "${question}"

You already explained it like this, and the student said they did NOT understand:
"""
${previousReply.slice(0, 1500)}
"""

Explain it again in the new style. Do not repeat the same wording.`;
  }
  return `${pastBlock}The student's latest message: "${question}"

Reply to this message in the context of the conversation above.`;
}

// Grades the student's reply to the last check question.
function buildJudgeSystem() {
  return `You grade a student's short reply to a DSA check question. Be fair: accept equivalent wording, ignore typos and spelling.
- isAnswer = false only if the student is NOT trying to answer (they ask a new question, change topic, or chat).
- "I don't know" or a blank guess counts as an attempt: isAnswer true, verdict "wrong".
- verdict: "correct" (fully right), "partial" (some right, something missing or wrong), "wrong".
- whatRight / whatMissing: one short phrase each, or "".
- misconception: the likely wrong idea behind a wrong answer, or "".
- concept: 1 to 3 lowercase words naming the concept tested.`;
}

function buildJudgePrompt({ question, expected, studentReply }) {
  return `Check question: ${question}
Correct answer: ${expected}
Student reply: ${String(studentReply).slice(0, 800)}`;
}

const JUDGE_SCHEMA = '{ "isAnswer": true, "verdict": "correct | partial | wrong", "whatRight": "", "whatMissing": "", "misconception": "", "concept": "" }';

// The student just came back from the code editor: the mentor reviews that attempt.
function buildPracticeReviewSystem({ memories }) {
  return `You are IntelliPrep, a friendly DSA placement mentor for Indian college students.
The student has just come back from the code editor to this chat. Write ONE short message (80 to 150 words) reviewing the attempt you are given.

Rules:
- If it PASSED: the FIRST line must be a short celebration with an emoji (for example "🎉 Wow, you nailed it!"). Then praise something specific from THEIR code (a good base case, a clean approach, etc). Add at most one improvement idea (an edge case or complexity).
- If it FAILED: the FIRST line must be a short encouraging line (for example "Good try, you are close!"). Then give **What went wrong:** pointing at a real line or construct in THEIR code, and **Hint:** a nudge toward the fix. Never give the full solution.
- Always mention that you saw their attempt from the code editor.
- If a memory shows the same kind of mistake happened before, mention it in one sentence. Never claim to remember anything not listed.
- The result comes from an AI review of the code, not from actually running it. Do not say tests were executed.
- End by inviting them to continue (retry, walk through the fix, or move on). Do not ask a quiz question. No hidden blocks.
- Use markdown. Short code snippets in code blocks are fine.

What you know about this student (memories):
${memoryLines(memories)}`;
}

function buildPracticeReviewPrompt({ attempt, question, history = [] }) {
  const past = historyText(history);
  const pastBlock = past ? `Conversation so far:\n${past}\n\n` : '';
  return `${pastBlock}Problem: ${question ? question.title : attempt.questionId} (${attempt.topic})
${question ? `Task given: ${question.prompt}\n` : ''}Result: ${attempt.result} (${attempt.testsPassed}/${attempt.testsTotal} tests)
Error type: ${attempt.errorType}
Judge note: ${attempt.explanation || '(none)'}

Student's code:
\`\`\`
${String(attempt.code).slice(0, 3000)}
\`\`\`

Write the review message now.`;
}

function practiceFallbackReview(attempt, question) {
  const title = question ? question.title : attempt.questionId;
  if (attempt.result === 'pass') {
    return `🎉 **Wow, you got it right!**\n\nI saw your attempt on **${title}** in the code editor and it passed (${attempt.testsPassed}/${attempt.testsTotal}). Great work! Want to try a harder one, or go deeper into **${attempt.topic}**?`;
  }
  return `**Good try, you are close!**\n\nI saw your attempt on **${title}** in the code editor and it did not pass yet (${attempt.testsPassed}/${attempt.testsTotal}).${attempt.explanation ? `\n\n**What went wrong:** ${attempt.explanation}` : ''}\n\nWant to walk through the fix, or go back and retry?`;
}

// Used when Gemini is down so the demo never shows a blank screen
function fallbackReply(topic, style) {
  const t = topic || 'this topic';
  return `I'm having trouble reaching my AI engine right now, so here is a quick note on **${t}** (${style} style).\n\nTry breaking the problem into the smallest possible case first, then build up from there. Please click "New session" or retry in a few seconds for a full answer.`;
}

export {
  buildMentorSystem,
  buildMentorPrompt,
  buildPracticeReviewSystem,
  buildPracticeReviewPrompt,
  practiceFallbackReview,
  buildJudgeSystem,
  buildJudgePrompt,
  JUDGE_SCHEMA,
  fallbackReply,
  STYLE_GUIDE,
};