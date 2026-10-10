export interface SmsProvider {
  send(phone: string, text: string): Promise<void>;
}

/** Development only. Prints the OTP on stderr so it is visible without a log-level filter. */
export class LogSmsProvider implements SmsProvider {
  constructor(nodeEnv: string = process.env.NODE_ENV ?? 'development') {
    if (nodeEnv === 'production') {
      throw new Error('LogSmsProvider cannot run when NODE_ENV=production');
    }
  }

  async send(phone: string, text: string): Promise<void> {
    const code = text.match(/\d{6}/)?.[0] ?? text;
    console.warn(`[DEV OTP] ${phone} → ${code}`);
  }
}

/** Production provider placeholder. Implemented when TextMe credentials exist. */
export class TextMeSmsProvider implements SmsProvider {
  async send(_phone: string, _text: string): Promise<void> {
    throw new Error('not configured');
  }
}

let installed: SmsProvider | null = null;

/**
 * Development uses the log provider. Production uses TextMe.
 * Startup in production constructs LogSmsProvider only to prove it refuses to run,
 * then installs TextMe.
 */
export function installSmsProvider(nodeEnv: string): SmsProvider {
  if (nodeEnv === 'production') {
    try {
      new LogSmsProvider('production');
      throw new Error('LogSmsProvider must refuse to start in production');
    } catch (error) {
      if (error instanceof Error && error.message === 'LogSmsProvider must refuse to start in production') {
        throw error;
      }
    }
    installed = new TextMeSmsProvider();
    return installed;
  }
  installed = new LogSmsProvider(nodeEnv);
  return installed;
}

export function getSmsProvider(): SmsProvider {
  if (!installed) {
    installed = installSmsProvider(process.env.NODE_ENV ?? 'development');
  }
  return installed;
}
