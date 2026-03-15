import { Logger } from '../utils/Logger';

type Task<T, R> = {
  data: T;
  resolve: (result: R) => void;
  reject: (err: Error) => void;
};

/**
 * Universal WorkerPool. Automatically handles browser Web Workers or Node worker_threads.
 * Takes a worker factory function to remain bundler-agnostic.
 */
export class WorkerPool<T, R> {
  private workers: any[] = [];
  private idleWorkers: any[] =[];
  private queue: Task<T, R>[] =[];
  private activeTasks: Map<any, Task<T, R>> = new Map();
  private logger = new Logger('worker-pool');
  private isNode: boolean;

  constructor(
    private workerFactory: () => any, 
    private poolSize: number = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4
  ) {
    this.isNode = typeof window === 'undefined';
    this.logger.info(`Initializing pool with ${this.poolSize} workers`);
    for (let i = 0; i < this.poolSize; i++) {
      this.addWorker();
    }
  }

  private addWorker() {
    const worker = this.workerFactory();
    
    const onMessage = (msg: any) => {
      const data = this.isNode ? msg : msg.data;
      const task = this.activeTasks.get(worker);
      if (task) {
        if (data.error) task.reject(new Error(data.error));
        else task.resolve(data.result);
        this.activeTasks.delete(worker);
      }
      this.idleWorkers.push(worker);
      this.processQueue();
    };

    const onError = (err: any) => {
      const task = this.activeTasks.get(worker);
      if (task) {
        task.reject(err);
        this.activeTasks.delete(worker);
      }
      // Recreate dead worker
      this.workers = this.workers.filter(w => w !== worker);
      this.addWorker();
    };

    if (this.isNode) {
      worker.on('message', onMessage);
      worker.on('error', onError);
    } else {
      worker.onmessage = onMessage;
      worker.onerror = onError;
    }

    this.workers.push(worker);
    this.idleWorkers.push(worker);
  }

  public execute(data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ data, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.queue.length === 0 || this.idleWorkers.length === 0) return;

    const task = this.queue.shift()!;
    const worker = this.idleWorkers.shift()!;

    this.activeTasks.set(worker, task);
    
    if (this.isNode) {
      worker.postMessage(task.data);
    } else {
      worker.postMessage(task.data);
    }
  }

  public terminate() {
    this.workers.forEach(w => this.isNode ? w.terminate() : w.terminate());
    this.workers = [];
    this.idleWorkers =[];
  }
}