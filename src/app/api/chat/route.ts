import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { getTools } from '@/lib/tools';

/**
 * Authoritative System Prompt instructing autonomous multi-step tool execution.
 * Fulfills Acceptance Criterion 3 and PROJECT.md requirements.
 */
export const AGENT_SYSTEM_PROMPT = `
You are the Cloud Coding AI Agent, an autonomous developer assistant.
You have access to two categories of tools:
1. GitHub Tools (executed on server):
   - githubCreateRepo: Create a new repository on GitHub.
   - githubGetRepo: Get details and metadata of an existing GitHub repository.
   - githubListRepos: List repositories accessible to the authenticated user.
   - githubWriteFile: Create or update a file in a GitHub repository.
   - githubReadFile: Read file content from a GitHub repository.
2. Sandbox Tools (executed in client WebContainer):
   - bootSandbox: Boot or reset the in-browser WebContainer sandbox.
   - sandboxWriteFile: Write files into the sandbox filesystem.
   - sandboxReadFile: Read files from the sandbox filesystem.
   - sandboxRunCommand: Run shell commands (e.g. node, npm) in the sandbox.
   - sandboxStartServer: Start dev or web servers in the sandbox.

Autonomous Operation & Planning Instructions:
- Plan and execute tools sequentially to fulfill user requests without unnecessary round-trips.
- When asked to create a repository, use githubCreateRepo with a valid repository name.
- When asked to execute or run code, use sandboxWriteFile to write the script and sandboxRunCommand to run it.
- When prompted with multi-action requests such as "Create a repo called test and run a hello world script", you MUST autonomously emit BOTH the GitHub creation tool call and the Sandbox execution tool calls in sequence.
- Do not stop until all requested actions have been initiated or executed.
- Always inspect tool results before concluding and present a clear summary of the actions taken.
`.trim();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model, systemInstruction, apiKey } = body;

    // Extract GitHub token from custom header or authorization header
    const githubToken =
      req.headers.get('x-github-token') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      undefined;

    const effectiveApiKey =
      apiKey ||
      req.headers.get('x-openrouter-key') ||
      process.env.OPENROUTER_API_KEY;

    if (!effectiveApiKey) {
      return new Response(
        JSON.stringify({
          error:
            'OpenRouter API key is not configured. Please supply an API key in settings or environment.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const openrouter = createOpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: effectiveApiKey,
      headers: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Cloud Coding AI Agent',
      },
    });

    const system = systemInstruction
      ? `${AGENT_SYSTEM_PROMPT}\n\nAdditional Instructions:\n${systemInstruction}`
      : AGENT_SYSTEM_PROMPT;

    // Call streamText with maxSteps: 10 enabling autonomous multi-step loop
    const result = await streamText({
      model: openrouter(model || 'openrouter/free'),
      system,
      messages,
      tools: getTools(githubToken),
      maxSteps: 10,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        error: message || 'An unexpected error occurred during chat orchestration.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
