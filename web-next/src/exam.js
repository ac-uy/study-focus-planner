// Mini multiple-choice exam built by the AI from a piece of study material.
import { api } from './api.js';
import { state, save, levelLabel } from './store.js';
import { getLang, t, subjectName } from './i18n.js';
import { h } from './util.js';
import { register, refresh } from './actions.js';

const ex = { busy: false, error: '', questions: null, answers: {}, submitted: false };
let seq = 0;

export function resetExam() {
  seq++;
  ex.busy = false; ex.error = ''; ex.questions = null; ex.answers = {}; ex.submitted = false;
}
export const examBusy = () => ex.busy;

export async function generateExam(text, subject) {
  if (ex.busy) return;
  resetExam();
  const token = seq;
  ex.busy = true;
  refresh();
  try {
    const res = await api('POST', '/api/ai/exam', { text, subject: subject ? subjectName(subject) : '', lang: getLang(), level: levelLabel(state.settings.level) });
    if (token !== seq) return;
    ex.questions = res.questions || [];
    state.counters.exams++;
    save('counters');
  } catch (e) {
    if (token !== seq) return;
    ex.error = e && e.status === 429 ? t('errLimit') : t('examErr');
  }
  ex.busy = false;
  refresh();
}

export function examView() {
  if (ex.busy) return h`<div class="muted">${t('examBusy')}</div>`;
  const parts = [];
  if (ex.error) parts.push(h`<div class="err">${ex.error}</div>`);
  if (ex.questions && ex.questions.length) {
    let score = 0;
    ex.questions.forEach((q, qi) => { if (ex.submitted && ex.answers[qi] === q.answer) score++; });
    parts.push(h`${ex.questions.map((q, qi) => h`<div class="q"><strong>${qi + 1}. ${q.question}</strong>
      ${q.options.map((o, oi) => {
        const cls = ex.submitted ? (oi === q.answer ? 'ok' : oi === ex.answers[qi] ? 'bad' : '') : '';
        return h`<label class="${cls}"><input type="radio" name="q${qi}" data-change="exam.pick" data-q="${qi}" data-o="${oi}"${ex.answers[qi] === oi ? h` checked` : ''}${ex.submitted ? h` disabled` : ''}> ${o}</label>`;
      })}
      ${ex.submitted && q.explanation ? h`<div class="why">${q.explanation}</div>` : ''}</div>`)}
      ${ex.submitted ? h`<p><strong>${t('score', { n: score, total: ex.questions.length })}</strong></p>` : h`<p><button class="btn" data-act="exam.submit">${t('checkAnswers')}</button></p>`}`);
  }
  return h`${parts}`;
}

register('exam', {
  pick(el) { ex.answers[+el.dataset.q] = +el.dataset.o; },
  submit() { ex.submitted = true; refresh(); },
});
