import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {getDefaultGeminiModel} from '@/config/gemini-models';

export const ai = genkit({
  plugins: [googleAI()],
  model: getDefaultGeminiModel('genkit'),
});
