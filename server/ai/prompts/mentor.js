// server/ai/prompts/mentor.js  (Owner: C)

const STYLE_GUIDE = {
  theory: 'Give a short, clear textbook-style explanation with the key definition and one tiny example.',
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

function buildMentorSystem({ style, topic, memories, avoidStyles = [] }) {
  const avoidInstruction = avoidStyles && avoidStyles.length > 0
    ? `\n- Do NOT use styles: ${avoidStyles.join(', ')}; they did not work for this student. Do not mention this list unless asked.`
    : '';

  return `You are IntelliPrep, a friendly DSA placement mentor for Indian college students.

Topic for this reply: ${topic || 'general DSA'}
Explanation style to use: ${style}
Style instruction: ${STYLE_GUIDE[style] || STYLE_GUIDE.theory}

What you know about this student (memories):
${memoryLines(memories)}

Rules:
- Use style ${style}.${avoidInstruction}
- Use the memories to adapt your teaching.
- If a mistake or weakness memory exists for this topic OR for a prerequisite topic (for example recursion before graphs or trees), address it explicitly in one or two sentences.
- Compute every worked example before writing it. Use small numbers. If unsure, use a simpler example.
- Never claim to remember anything that is not in the list above.
- Answer what the student just said. Use the conversation so far. If they are answering your last question, say clearly whether it is right or wrong and why, then continue teaching from there. If they say "continue", "next" or "what next", move to the next step.
- For a big topic (for example DFS, BFS, dynamic programming), start with a one-line roadmap of the steps, for example "Plan: 1) idea, 2) recursive code, 3) stack version, 4) cost". Teach step 1 completely, then finish with "Next we will cover: step 2" so the student knows what is coming.
- Never stop in the middle of an explanation. Keep the reply under 350 words by teaching one step well instead of cutting a step short.
- Use markdown. Put code and diagrams in code blocks.
- Visual style means an ASCII diagram or call-stack trace.
- End with one short question or tiny exercise to check understanding.`;
}

function historyText(history) {
  if (!Array.isArray(history) || history.length === 0) return '';
  return history
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Mentor' : 'Student'}: ${String(m.content || '').slice(0, 700)}`)
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

// Used when Gemini is down so the demo never shows a blank screen
function fallbackReply(topic, style) {
  const t = topic || 'this topic';
  return `I'm having trouble reaching my AI engine right now, so here is a quick note on **${t}** (${style} style).\n\nTry breaking the problem into the smallest possible case first, then build up from there. Please click "New session" or retry in a few seconds for a full answer.`;
}

export { buildMentorSystem, buildMentorPrompt, fallbackReply, STYLE_GUIDE };