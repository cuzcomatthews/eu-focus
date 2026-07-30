const API_KEY = process.env.DEEPGRAM_API_KEY || '';
const BASE_URL = 'https://api.deepgram.com/v1/listen';

export async function transcribeAudio(audioBuffer: ArrayBuffer, mimetype: string): Promise<string> {
  const response = await fetch(`${BASE_URL}?model=nova-3&language=es&smart_format=true`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${API_KEY}`,
      'Content-Type': mimetype || 'audio/webm',
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Deepgram error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
}