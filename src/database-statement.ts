import { RunResult, Statement } from 'sqlite3';

export class DatabaseStatement {
  constructor(protected statement: Statement) {}

  public async run(...params: any[]): Promise<RunResult> {
    return new Promise<RunResult>(
      (
        resolve: (result: RunResult) => void,
        reject: (err: Error) => void,
      ): void => {
        this.statement.run(params, function(err?: Error): void {
          if (err) {
            reject(err);
          } else {
            resolve(this);
          }
        });
      },
    );
  }

  public async finalize(): Promise<void> {
    return new Promise<void>(
      (resolve: () => void, reject: (err: Error) => void): void => {
        this.statement.finalize((err?: Error) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      },
    );
  }
}
