export const onRequestPost = async ({ request, env }) => {
  const form = await request.formData();
  const audioFile = form.get('file');
  if (!audioFile) {
    return jsonRes({ error: 'file required' }, 400);
  }

  const whisperRes = await fetch(
    'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.HF_API_TOKEN}`,
        'Content-Type': audioFile.type || 'audio/mpeg',
        Accept: 'application/json',
      },
      body: audioFile,
    },
  );

  if (!whisperRes.ok) {
    return jsonRes(
      { error: 'whisper failed', detail: await whisperRes.text() },
      500,
    );
  }

  const whisperJson = await whisperRes.json();
  const transcript = Array.isArray(whisperJson)
    ? whisperJson[0]?.text ?? ''
    : whisperJson.text ?? '';

  const gemmaRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPEN_ROUTER_API_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemma-3n-e4b-it:free',
      messages: [
        {
          role: 'user',
          content: `以下の全文を300文字以内で日本語要約してください。\n\n${transcript}`,
        },
      ],
      max_tokens: 256,
      temperature: 0,
    }),
  });

  const ct = gemmaRes.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return jsonRes(
      {
        error: 'summarizer failed',
        detail: `Non-JSON response (${gemmaRes.status}). Token/endpoint をご確認ください。`,
        preview: (await gemmaRes.text()).slice(0, 300),
      },
      500,
    );
  }

  if (!gemmaRes.ok) {
    return jsonRes(
      { error: 'summarizer failed', detail: await gemmaRes.text() },
      500,
    );
  }

  const gemmaJson = await gemmaRes.json();
  const summary = gemmaJson.choices?.[0]?.message?.content ?? '';
  return jsonRes({ transcript, summary });
};

const jsonRes = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });