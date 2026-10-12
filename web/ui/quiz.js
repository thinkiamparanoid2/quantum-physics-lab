// Multiple-choice questions with explanations, used for each lesson's "Check yourself" block and
// on the teacher page. A question is { q, options: [...], answer: index, why }.

const LETTERS = 'ABCDEF';

export function quizHtml(questions, { reveal = false, idPrefix = 'q' } = {}) {
  return questions
    .map(
      (item, i) => `<li class="quiz-item" data-q="${i}">
        <p class="quiz-q"><span class="quiz-num">${i + 1}</span>${item.q}</p>
        <div class="quiz-options" role="group" aria-label="Answers to question ${i + 1}">
          ${item.options
            .map(
              (o, k) => `<button type="button" class="quiz-option${reveal && k === item.answer ? ' correct' : ''}" data-k="${k}"
                id="${idPrefix}-${i}-${k}"><b>${LETTERS[k]}</b><span>${o}</span></button>`,
            )
            .join('')}
        </div>
        <p class="quiz-why"${reveal ? '' : ' hidden'}>${item.why}</p>
      </li>`,
    )
    .join('');
}

// Wires up answer buttons inside `root` (an element containing quizHtml output).
export function bindQuiz(root, questions, onAnswer) {
  root.addEventListener('click', (e) => {
    const button = e.target.closest('.quiz-option');
    if (!button || !root.contains(button)) return;
    const item = button.closest('.quiz-item');
    const q = questions[Number(item.dataset.q)];
    const k = Number(button.dataset.k);
    item.querySelectorAll('.quiz-option').forEach((b) => {
      b.classList.remove('chosen', 'correct', 'wrong');
      const j = Number(b.dataset.k);
      if (j === q.answer) b.classList.add('correct');
      if (j === k) b.classList.add('chosen', j === q.answer ? 'correct' : 'wrong');
    });
    item.classList.toggle('answered-right', k === q.answer);
    item.classList.toggle('answered-wrong', k !== q.answer);
    item.querySelector('.quiz-why').hidden = false;
    onAnswer?.(Number(item.dataset.q), k === q.answer);
  });
}
