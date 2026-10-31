// server/ai/prompts/mentor.js  (Owner: C)

const STYLE_GUIDE = {
  theory: 'Give a short, clear textbook-style explanation with the key definition and one tiny example.',
  simple: 'Explain in very simple everyday words, like to a beginner. No jargon. Very short sentences.',
  analogy: 'Explain using one real-life analogy (for example stacks of plates, a queue at a canteen, Russian dolls), then connect it back to the code idea.',
  visual: 'Explain with an ASCII diagram or a call-stack / step trace inside a code block. Use very few words around it.',
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

function buildMentorSystem({ style, topic, memories }) {
  return `You are IntelliPrep, a friendly DSA placement mentor for Indian college students.

Topic for this reply: ${topic || 'general DSA'}
Explanation style to use: ${style}
Style instruction: ${STYLE_GUIDE[style] || STYLE_GUIDE.theory}

What you know about this student (memories):
${memoryLines(memories)}

Rules:
- Use the memories to adapt your teaching.
- If a mistake or weakness memory exists for this topic OR for a prerequisite topic (for example recursion before graphs or trees), address it explicitly in one or two sentences.
- Never claim to remember anything that is not in the list above.
- Keep the reply under 250 words.
- Use markdown. Put code and diagrams in code blocks.
- Visual style means an ASCII diagram or call-stack trace.
- End with one short question or tiny exercise to check understanding.`;
}

function buildMentorPrompt({ question, previousReply }) {
  if (previousReply) {
    return `The student asked: "${question}"

You already explained it like this, and the student said they did NOT understand:
"""
${previousReply.slice(0, 1500)}
"""

Explain it again in the new style. Do not repeat the same wording.`;
  }
  return `The student asked: "${question}"`;
}

// Used when Gemini is down so the demo never shows a blank screen
function fallbackReply(topic, style) {
  const t = topic || 'this topic';
  return `I'm having trouble reaching my AI engine right now, so here is a quick note on **${t}** (${style} style).\n\nTry breaking the problem into the smallest possible case first, then build up from there. Please click "New session" or retry in a few seconds for a full answer.`;
}

export { buildMentorSystem, buildMentorPrompt, fallbackReply, STYLE_GUIDE };