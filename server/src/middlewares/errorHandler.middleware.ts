import { Request, Response, NextFunction } from 'express';
import { NODE_ENV } from '../config/env';
import { AppError } from '../utils/AppError';

interface ErrorResponse {
  success: false;
  message: string;
  stack?: string;
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const isOperational = err instanceof AppError;
  const statusCode = isOperational ? (err as AppError).statusCode : 500;
  const message = isOperational ? err.message : 'Internal server error';

  const response: ErrorResponse = {
    success: false,
    message,
  };

  if (NODE_ENV === 'development' && !isOperational) {
    response.stack = err.stack;
  }

  if (NODE_ENV === 'development') {
    console.error(err);
  }

  res.status(statusCode).json(response);
}
