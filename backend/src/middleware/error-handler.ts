import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../shared/errors/app.error';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      status: 'error',
      message: err.message,
    };

    if (err instanceof ValidationError && err.errors) {
      body.errors = err.errors;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // Unexpected error
  console.error('[error]', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  const message =
    env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message;

  res.status(500).json({ status: 'error', message });
}
