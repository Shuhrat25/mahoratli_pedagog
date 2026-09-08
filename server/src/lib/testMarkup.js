// ТЗ §6.5: test fayli quyidagi belgilash bilan yoziladi:
//  ~ (javob matni)   — to'g'ri variant
//  == (javob matni)  — noto'g'ri variant
//  ++++              — savollar orasidagi ajratuvchi
function parseTestMarkup(raw) {
  const blocks = raw
    .split("++++")
    .map((b) => b.trim())
    .filter(Boolean);

  const questions = [];
  blocks.forEach((block) => {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const questionText = lines[0];
    const options = [];
    lines.slice(1).forEach((line) => {
      if (line.startsWith("~")) {
        options.push({ text: line.replace(/^~\s*/, ""), correct: true });
      } else if (line.startsWith("==")) {
        options.push({ text: line.replace(/^==\s*/, ""), correct: false });
      }
    });
    if (options.length > 0) {
      questions.push({ text: questionText, options });
    }
  });
  return questions;
}

module.exports = { parseTestMarkup };
