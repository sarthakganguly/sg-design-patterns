export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  constructor(private prefix: string = 'engine', private level: LogLevel = 'info') {}

  private getLevelWeight(lvl: LogLevel): number {
    const weights: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return weights[lvl];
  }

  private log(lvl: LogLevel, message: string, ...args: any[]): void {
    if (this.getLevelWeight(lvl) < this.getLevelWeight(this.level)) return;
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${this.prefix}][${lvl.toUpperCase()}] ${message}`;
    
    switch (lvl) {
      case 'debug': console.debug(formattedMessage, ...args); break;
      case 'info': console.info(formattedMessage, ...args); break;
      case 'warn': console.warn(formattedMessage, ...args); break;
      case 'error': console.error(formattedMessage, ...args); break;
    }
  }

  public debug(msg: string, ...args: any[]) { this.log('debug', msg, ...args); }
  public info(msg: string, ...args: any[]) { this.log('info', msg, ...args); }
  public warn(msg: string, ...args: any[]) { this.log('warn', msg, ...args); }
  public error(msg: string, ...args: any[]) { this.log('error', msg, ...args); }
}