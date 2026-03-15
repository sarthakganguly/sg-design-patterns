import { Logger } from '../utils/Logger';

interface Task<T, R> {
  data: T;
  resolve: (result: R) => void;
  reject: (err: Error) => void;
}

export class WorkerPool<T, R> {
  private workers: any[]       = [];
  private idleWorkers: any[]   = [];
  private queue: Task<T, R>[]  = [];
  private activeTasks: Map<any, Task<T, R>> = new Map();
  private logger = new Logger('WorkerPool');
  private readonly isNode: boolean;

  constructor(
    private workerFactory: () => any,
    private poolSize: number = typeof navigator !== 'undefined'
      ? (navigator.hardwareConcurrency ?? 4)
      : 4
  ) {
    this.isNode = typeof window === 'undefined';
    this.logger.info(`Starting ${this.poolSize} workers`);
    for (let i = 0; i < this.poolSize; i++) this.spawnWorker();
  }

  get size(): number { return this.poolSize; }
  get pending(): number { return this.queue.length; }
  get active(): number { return this.activeTasks.size; }

  public execute(data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ data, resolve, reject });
      this.drain();
    });
  }

  public terminate(): void {
    this.workers.forEach(w => w.terminate());
    this.workers      = [];
    this.idleWorkers  = [];
    this.queue        = [];
    this.activeTasks.clear();
  }

  private spawnWorker(): void {
    const worker = this.workerFactory();

    const onMessage = (msg: any) => {
      const data = this.isNode ? msg : msg.data;
      const task = this.activeTasks.get(worker);
      if (task) {
        if (data.error) task.reject(new Error(data.error));
        else            task.resolve(data.result as R);
        this.activeTasks.delete(worker);
      }
      this.idleWorkers.push(worker);
      this.drain();
    };

    const onError = (err: any) => {
      this.logger.error('Worker error', err);
      const task = this.activeTasks.get(worker);
      if (task) {
        task.reject(err instanceof Error ? err : new Error(String(err)));
        this.activeTasks.delete(worker);
      }
      // Replace the dead worker
      this.workers = this.workers.filter(w => w !== worker);
      this.spawnWorker();
    };

    if (this.isNode) {
      worker.on('message', onMessage);
      worker.on('error',   onError);
    } else {
      worker.onmessage = onMessage;
      worker.onerror   = onError;
    }

    this.workers.push(worker);
    this.idleWorkers.push(worker);
  }

  private drain(): void {
    while (this.queue.length > 0 && this.idleWorkers.length > 0) {
      const task   = this.queue.shift()!;
      const worker = this.idleWorkers.shift()!;
      this.activeTasks.set(worker, task);
      worker.postMessage(task.data);
    }
  }
}