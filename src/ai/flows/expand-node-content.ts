'use server';

/**
 * @fileOverview A flow to expand the content of a selected node using AI based on the node's title.
 *
 * - expandNodeContent - A function that handles expanding the node content with AI.
 * - ExpandNodeContentInput - The input type for the expandNodeContent function.
 * - ExpandNodeContentOutput - The return type for the expandNodeContent function.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ExpandNodeContentInput {
  title: string;
}

export interface ExpandNodeContentOutput {
  content: string;
}

export async function expandNodeContent(input: ExpandNodeContentInput): Promise<ExpandNodeContentOutput> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });

  const prompt = `You are an expert content writer.

You will be provided with a title for a node in an outline. Your task is to generate a detailed paragraph of content for that node based on the title.

Title: ${input.title}

Content:`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const content = response.text();

  return { content };
}
