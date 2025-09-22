// Correcciones ortográficas con el conector de Google IA
window.AI_CORRECTION_FIELDS = {
  imputations: ['comments'],
  tasks: ['taskDescription']
};

async function correctTextWithAI(text) {
  if (!window.aiConfig || !aiConfig.key || !aiConfig.model) return text;
  if (!text) return text;
  const prompt = `Correct only the spelling mistakes in the following ${aiConfig.lang} text. Do not omit or add any words; make only the necessary spelling corrections. Return only the corrected text, with no additional comments.`;
  const body = {
    contents: [{ parts: [{ text: `${prompt}\n\n${text}` }] }],
    generationConfig: { temperature: 0 }
  };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.model}:generateContent?key=${aiConfig.key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || text;
  } catch (err) {
    console.error(err);
    return text;
  }
}

window.applyAiCorrection = async function (table, data, original = {}) {
  const fields = AI_CORRECTION_FIELDS[table];
  if (!fields) return data;
  for (const f of fields) {
    const val = data[f];
    const prev = original[f] ?? '';
    if (typeof val === 'string' && val.trim() && val !== prev) {
      data[f] = await correctTextWithAI(val);
    }
  }
  return data;
};
