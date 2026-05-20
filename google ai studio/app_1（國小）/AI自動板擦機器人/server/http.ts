import type {Response} from 'express';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function sendError(res: Response, error: unknown, fallbackStatus = 500) {
  const status = error instanceof ApiError ? error.status : fallbackStatus;
  const details = error instanceof ApiError ? error.details : undefined;
  res.status(status).json({
    error: getErrorMessage(error),
    ...(details ? {details} : {}),
  });
}
