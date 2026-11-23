// Motivational quotes. The two lists are translations of each other, so the same index works in both languages.
export const QUOTES = {
  es: [
    'Cada ratito de estudio cuenta. Aunque sean 10 minutos.', 'Lo difícil de hoy será fácil mañana.', 'Un paso pequeño cada día te lleva muy lejos.',
    'Empezar es lo más difícil. Ya casi lo tienes.', 'No tienes que hacerlo perfecto, solo tienes que hacerlo.', 'Descansar también es parte de estudiar.',
    'Tu esfuerzo de hoy es el examen tranquilo de mañana.', 'Equivocarse es aprender más rápido.', 'Concéntrate en una sola cosa cada vez.',
    'Lo que repasas hoy, lo recuerdas mañana.', 'Compárate solo con quien eras ayer.', 'Si te cuesta, es que tu cerebro está creciendo.',
    'Una buena pregunta vale más que una respuesta rápida.', 'Primero lo difícil, después lo fácil.', 'Veinticinco minutos de atención valen más que dos horas con distracciones.',
    'Los apuntes de hoy te salvan la semana que viene.', 'Confía en el proceso: los resultados llegan.', 'Un día malo no borra una semana buena.',
    'Explícaselo a alguien: así sabrás si lo entiendes.', 'Dormir bien también es estudiar.', 'Hazlo ahora y luego sentirás orgullo.',
    'Los errores son pistas, no castigos.', 'Pequeñas metas, grandes avances.', 'Estudiar un poco cada día gana a estudiar mucho una noche.',
    'Tu yo del futuro te dará las gracias.', 'Guarda el móvil y gana media hora.', 'Todo experto fue alguna vez principiante.',
    'Aprender es un músculo: se entrena.', 'Respira hondo. Puedes con esto.', 'Termina lo que empezaste y celébralo.',
  ],
  en: [
    'Every little bit of study counts. Even just 10 minutes.', 'What is hard today will be easy tomorrow.', 'A small step every day takes you very far.',
    'Starting is the hardest part. You are almost there.', 'You do not have to do it perfectly, you just have to do it.', 'Resting is part of studying too.',
    'Today\'s effort is tomorrow\'s calm exam.', 'Making mistakes is learning faster.', 'Focus on one thing at a time.',
    'What you review today, you remember tomorrow.', 'Compare yourself only with who you were yesterday.', 'If it feels hard, your brain is growing.',
    'A good question is worth more than a quick answer.', 'Hard things first, easy things after.', 'Twenty-five minutes of attention beat two distracted hours.',
    'Today\'s notes save your next week.', 'Trust the process: results will come.', 'One bad day does not erase a good week.',
    'Explain it to someone: that is how you know you understand it.', 'Sleeping well is studying too.', 'Do it now and feel proud later.',
    'Mistakes are clues, not punishments.', 'Small goals, big progress.', 'A little study every day beats a lot in one night.',
    'Your future self will thank you.', 'Put the phone away and gain half an hour.', 'Every expert was once a beginner.',
    'Learning is a muscle: you train it.', 'Take a deep breath. You can do this.', 'Finish what you started and celebrate it.',
  ],
};

const KEY = 'sp2-lastquote';

// Picks a random quote different from `avoid` (an index) when possible.
export function randomIndex(avoid) {
  const n = QUOTES.es.length;
  let i = Math.floor(Math.random() * n);
  if (n > 1 && i === avoid) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
  return i;
}

// Every page load shows a new quote (never the same as the previous load).
export function firstQuoteIndex() {
  let last = -1;
  try { last = parseInt(localStorage.getItem(KEY), 10); } catch (e) { /* ignore */ }
  const i = randomIndex(isFinite(last) ? last : -1);
  try { localStorage.setItem(KEY, String(i)); } catch (e) { /* ignore */ }
  return i;
}
export function rememberQuote(i) {
  try { localStorage.setItem(KEY, String(i)); } catch (e) { /* ignore */ }
}
