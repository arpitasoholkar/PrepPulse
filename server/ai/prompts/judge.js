export function judgePrompt({ question, studentCode }) {
  return `You are an automated DSA judge evaluating student code.
Question Title: ${question.title}
Topic: ${question.topic}
Prompt: ${question.prompt}
Test cases: ${JSON.stringify(question.tests)}
Known common bug pattern: ${question.commonBug || 'None'}

Student Code:
\`\`\`${question.language || 'javascript'}
${studentCode}
\`\`\`

Evaluate the student's code against the test cases and algorithms standards.
Do not execute arbitrary code; logically deduce correctness against each test case.
Return JSON with the following fields:
- result: "pass", "fail", or "error"
- testsPassed: number of passing test cases
- testsTotal: total number of test cases
- errorType: one of ["off_by_one","wrong_base_case","wrong_loop_condition","logic_error","inefficient","edge_case_missed","syntax_error","none"]
- explanation: clear explanation of why it failed or succeeded
- hint: gentle guiding question or tip without giving full solution`;
}
