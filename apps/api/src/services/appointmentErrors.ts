/** Typed HTTP-style errors for appointment / booking flows (handled by global error middleware). */
export class AppointmentError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
