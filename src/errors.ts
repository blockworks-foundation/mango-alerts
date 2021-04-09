export class UserError extends Error {
  constructor(message = 'Error', ...params: any[]) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(...params);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UserError);
    }

    this.name = 'UserError';
    // Custom debugging information
    this.message = message;
  }
}
