// Errors we deliberately show to the client. Anything else becomes a generic 500.
class AppError extends Error {
  constructor(message, status = 400, code) {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

module.exports = AppError;
