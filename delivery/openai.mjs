export async function requestStructuredOutput({ name, schema, instructions, input, model = 'gpt-5' }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is required');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      store: false,
      instructions,
      input,
      text: { format: { type: 'json_schema', name, strict: true, schema } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const body = await response.json();
  try { return JSON.parse(body.output_text); }
  catch { throw new Error('OpenAI returned non-JSON structured output'); }
}
