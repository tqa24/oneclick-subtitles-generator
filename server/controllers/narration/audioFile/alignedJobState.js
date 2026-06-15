/**
 * In-memory progress tracking for aligned audio download jobs.
 *
 * Holds a short-lived map of job states keyed by jobId and prunes stale
 * entries so long-running processes don't leak memory.
 */

const ALIGNED_JOB_MAX_AGE_MS = 30 * 60 * 1000;
const alignedDownloadJobs = new Map();

const cleanupStaleAlignedJobs = () => {
  const now = Date.now();
  for (const [jobId, jobState] of alignedDownloadJobs.entries()) {
    if (!jobState?.updatedAt || now - jobState.updatedAt > ALIGNED_JOB_MAX_AGE_MS) {
      alignedDownloadJobs.delete(jobId);
    }
  }
};

const setAlignedJobProgress = (jobId, patch = {}) => {
  if (!jobId) {
    return null;
  }

  cleanupStaleAlignedJobs();
  const currentState = alignedDownloadJobs.get(jobId) || {
    jobId,
    progress: 0,
    status: "pending",
    messageKey: "alignedDownloadQueued",
    message: "Waiting to start aligned download...",
    processedSegments: 0,
    totalSegments: 0,
    createdAt: Date.now(),
    completed: false,
    error: null,
  };

  const nextState = {
    ...currentState,
    ...patch,
    updatedAt: Date.now(),
  };

  alignedDownloadJobs.set(jobId, nextState);
  return nextState;
};

const getAlignedJobState = (jobId) => {
  cleanupStaleAlignedJobs();
  return alignedDownloadJobs.get(jobId) || null;
};

module.exports = {
  ALIGNED_JOB_MAX_AGE_MS,
  alignedDownloadJobs,
  cleanupStaleAlignedJobs,
  setAlignedJobProgress,
  getAlignedJobState,
};
