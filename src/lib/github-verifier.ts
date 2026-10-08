/**
 * Automated Verification Routine for Acceptance Criterion 1 (GitHub Integration).
 * Cloud Coding AI Agent (Milestone M2)
 *
 * Verifies end-to-end GitHub capability:
 * 1. Validates provided PAT identity and permissions.
 * 2. Creates a new private repository with auto_init: true.
 * 3. Writes a verification file with known test content.
 * 4. Reads back the file and asserts byte-for-byte content integrity.
 */

import type {
  GitHubVerificationResult,
  GitHubVerificationStep,
} from '@/types/github';
import {
  validateAuth,
  createRepository,
  writeFile,
  readFile,
  deleteRepository,
} from './github';

export interface GitHubVerificationOptions {
  timeoutMs?: number;
  customRepoName?: string;
  cleanupRepo?: boolean;
  onLog?: (message: string) => void;
  onStep?: (step: GitHubVerificationStep) => void;
  baseUrl?: string;
}

/**
 * Runs the automated GitHub verification routine fulfilling Acceptance Criterion 1.
 */
export async function runGitHubVerificationTest(
  token: string,
  options: GitHubVerificationOptions = {}
): Promise<GitHubVerificationResult> {
  const {
    timeoutMs = 30000,
    customRepoName,
    cleanupRepo = false,
    onLog,
    onStep,
    baseUrl,
  } = options;

  const logs: string[] = [];
  const steps: GitHubVerificationStep[] = [];
  const startTime = Date.now();

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().slice(11, 19);
    const formatted = `[${timestamp}] ${message}`;
    logs.push(formatted);
    if (onLog) {
      try {
        onLog(formatted);
      } catch {
        // Ignore logger subscriber exceptions
      }
    }
  };

  const recordStep = (step: GitHubVerificationStep) => {
    steps.push(step);
    if (onStep) {
      try {
        onStep(step);
      } catch {
        // Ignore step subscriber exceptions
      }
    }
  };

  const repoName = customRepoName || `test-agent-verify-${Date.now()}`;
  let userLogin = '';
  let repoUrl = '';

  try {
    addLog('Starting GitHub Acceptance Criterion 1 verification routine...');

    if (!token || !token.trim()) {
      throw new Error(
        'GitHub Personal Access Token is missing. Provide a valid PAT in settings.'
      );
    }

    // Step 1: Validate PAT
    const step1Start = Date.now();
    addLog('Step 1/4: Validating GitHub Personal Access Token...');
    const user = await validateAuth(token, { baseUrl });
    userLogin = user.login;

    const scopesDetail =
      user.scopes.length > 0 ? user.scopes.join(', ') : 'default / fine-grained';
    const step1Duration = Date.now() - step1Start;

    addLog(
      `Step 1 PASSED: Authenticated as @${user.login} (ID: ${user.id}). Scopes: [${scopesDetail}].`
    );
    recordStep({
      name: 'Validate PAT',
      ok: true,
      detail: `Authenticated as @${user.login} (ID: ${user.id})`,
      durationMs: step1Duration,
    });

    // Step 2: Create private repository
    const step2Start = Date.now();
    addLog(`Step 2/4: Creating new private repository "${repoName}" with autoInit: true...`);
    const createdRepo = await createRepository(token, {
      name: repoName,
      description: 'Automated verification test repo for Cloud Coding AI Agent (AC1)',
      private: true,
      autoInit: true,
      baseUrl,
    });
    repoUrl = createdRepo.htmlUrl;
    const step2Duration = Date.now() - step2Start;

    if (!createdRepo.private) {
      throw new Error(
        `Repository ${createdRepo.fullName} was created but private flag is false.`
      );
    }

    addLog(
      `Step 2 PASSED: Private repository created at ${createdRepo.htmlUrl} (default branch: ${createdRepo.defaultBranch}).`
    );
    recordStep({
      name: 'Create Private Repository',
      ok: true,
      detail: `Created private repository ${createdRepo.fullName} (${createdRepo.htmlUrl})`,
      durationMs: step2Duration,
    });

    // Step 3: Write a text file with known content
    const step3Start = Date.now();
    const testFileName = 'verification.txt';
    const uniqueNonce = Math.random().toString(36).slice(2, 10);
    const expectedContent = [
      '# Cloud Coding AI Agent Verification',
      `Timestamp: ${new Date().toISOString()}`,
      `Repository: ${createdRepo.fullName}`,
      `Nonce: ${uniqueNonce}`,
      'Status: Acceptance Criterion 1 Verified Successfully',
    ].join('\n');

    addLog(`Step 3/4: Writing test file "${testFileName}" with known content...`);
    const commitResult = await writeFile(
      token,
      userLogin,
      repoName,
      testFileName,
      expectedContent,
      'test(verify): automated AC1 verification commit',
      { baseUrl }
    );
    const step3Duration = Date.now() - step3Start;

    if (!commitResult.commitSha) {
      throw new Error('File write succeeded but no commit SHA was returned.');
    }

    addLog(
      `Step 3 PASSED: Committed "${testFileName}" (commit: ${commitResult.commitSha.slice(0, 7)}).`
    );
    recordStep({
      name: 'Write Test File',
      ok: true,
      detail: `Committed "${testFileName}" (SHA: ${commitResult.commitSha.slice(0, 7)})`,
      durationMs: step3Duration,
    });

    // Step 4: Read back file and assert content
    const step4Start = Date.now();
    addLog(`Step 4/4: Reading back "${testFileName}" and asserting content match...`);
    const fileResult = await readFile(token, userLogin, repoName, testFileName, { baseUrl });
    const step4Duration = Date.now() - step4Start;

    if (fileResult.content !== expectedContent) {
      throw new Error(
        `Content mismatch! Expected length ${expectedContent.length}, got ${fileResult.content.length}.`
      );
    }

    addLog('Step 4 PASSED: Read back content matches written content byte-for-byte.');
    recordStep({
      name: 'Read & Assert File',
      ok: true,
      detail: `File content verified successfully (${fileResult.size} bytes)`,
      durationMs: step4Duration,
    });

    // Optional Step: Cleanup repo if explicitly requested
    if (cleanupRepo) {
      addLog(`Cleaning up test repository "${repoName}"...`);
      try {
        await deleteRepository(token, userLogin, repoName, { baseUrl });
        addLog('Test repository deleted cleanly.');
      } catch (cleanErr) {
        addLog(
          `Warning: Could not delete repository "${repoName}". PAT may lack 'delete_repo' scope.`
        );
      }
    }

    const durationMs = Date.now() - startTime;
    addLog(`GitHub verification routine complete! Total elapsed time: ${durationMs}ms.`);

    return {
      success: true,
      durationMs,
      repo: repoName,
      repoUrl,
      steps,
      logs,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    addLog(`Verification FAILED: ${errorMsg}`);

    // If an in-progress step failed, record it
    if (steps.length < 4) {
      const stepNames = [
        'Validate PAT',
        'Create Private Repository',
        'Write Test File',
        'Read & Assert File',
      ];
      const failedStepName = stepNames[steps.length] || 'Verification Step';
      recordStep({
        name: failedStepName,
        ok: false,
        detail: `Failed: ${errorMsg}`,
      });
    }

    const durationMs = Date.now() - startTime;
    return {
      success: false,
      durationMs,
      repo: repoName,
      repoUrl: repoUrl || undefined,
      steps,
      logs,
      error: errorMsg,
    };
  }
}

/**
 * Convenient aliases
 */
export const runGitHubVerification = runGitHubVerificationTest;
export const verifyGitHub = runGitHubVerificationTest;

export default runGitHubVerificationTest;
