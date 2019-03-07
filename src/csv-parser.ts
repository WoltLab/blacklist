import { createHash, Hash } from 'crypto';
import * as csvParse from 'csv-parse';
import { Service } from 'typedi';

@Service()
export class CsvParser {
  public async parse(buffer: Buffer): Promise<ICsvRow[]> {
    const records = await this.parseCsv(buffer);

    return records.map(
      (columns: string[]): ICsvRow => {
        return {
          hash: this.getHash(columns[0]),
          lastSeen: new Date(`${columns[2]}Z`).getTime(),
          occurrences: parseInt(columns[1], 10),
        };
      },
    );
  }

  protected async parseCsv(buffer: Buffer): Promise<string[][]> {
    return new Promise<string[][]>(
      (
        resolve: (rows: string[][]) => void,
        reject: (err: Error) => void,
      ): void => {
        csvParse(
          buffer.toString(),
          { escape: '\\' },
          (err: Error | undefined, records: string[][] | undefined) => {
            if (err) {
              reject(err);
            } else {
              resolve(records);
            }
          },
        );
      },
    );
  }

  protected getHash(input: string): string {
    return createHash('sha256')
      .update(input)
      .digest('hex');
  }
}

export interface ICsvRow {
  hash: string;
  lastSeen: number;
  occurrences: number;
}
