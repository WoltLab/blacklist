import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const fsReaddir = promisify(fs.readdir);
const fsRmdir = promisify(fs.rmdir);
const fsStat = promisify(fs.stat);
const fsUnlink = promisify(fs.unlink);
const fsWriteFile = promisify(fs.writeFile);

export class BlacklistIndex {
  constructor(
    protected readonly now: Date,
    protected readonly outDir: string,
  ) {}

  public async rebuild(): Promise<void> {
    const validDates: string[] = [];
    const day = new Date(this.now.getTime());
    // Keeping "today" plus two weeks of historical data.
    for (let i = 0; i < 15; i++) {
      validDates.push(day.toISOString().substr(0, 10));
      day.setDate(day.getDate() - 1);
    }

    let data: IBlacklistIndexEntry[] = [];
    const removeDirectories: string[] = [];

    await Promise.all(
      (await fsReaddir(this.outDir)).map(
        async (directory: string): Promise<void> => {
          if (
            /^[0-9]{4}\-[0-9]{2}\-[0-9]{2}$/.exec(directory) &&
            (await fsStat(path.join(this.outDir, directory))).isDirectory()
          ) {
            if (validDates.indexOf(directory) === -1) {
              removeDirectories.push(directory);

              return;
            }

            const files: string[] = [];
            const dirPath = path.join(this.outDir, directory);
            await Promise.all(
              (await fsReaddir(dirPath)).map(
                async (file: string): Promise<void> => {
                  if (file === 'full.json' || /^delta\-[1-4]\.json$/) {
                    files.push(file);
                  }
                },
              ),
            );

            if (files.length) {
              data.push({
                date: directory,
                files: {
                  delta1: files.indexOf('delta1.json') !== -1,
                  delta2: files.indexOf('delta2.json') !== -1,
                  delta3: files.indexOf('delta3.json') !== -1,
                  delta4: files.indexOf('delta4.json') !== -1,
                  full: files.indexOf('full.json') !== -1,
                },
              });
            }
          }
        },
      ),
    );

    data = data.sort(
      (a: IBlacklistIndexEntry, b: IBlacklistIndexEntry): number => {
        const aTime = new Date(a.date).getTime();
        const bTime = new Date(b.date).getTime();

        if (aTime === bTime) {
          return 0;
        } else {
          return aTime > bTime ? -1 : 1;
        }
      },
    );

    await fsWriteFile(
      path.join(this.outDir, 'index.json'),
      JSON.stringify(data, null, 2),
    );

    await this.cleanup(removeDirectories);
  }

  protected async cleanup(directories: string[]): Promise<void> {
    await Promise.all(
      directories.map(
        async (directory: string): Promise<void> => {
          const dirPath = path.join(this.outDir, directory);
          await Promise.all(
            (await fsReaddir(directory)).map(
              async (file: string): Promise<void> => {
                await fsUnlink(path.join(dirPath, file));
              },
            ),
          );

          await fsRmdir(dirPath);
        },
      ),
    );
  }
}

interface IBlacklistIndexEntry {
  date: string;
  files: {
    delta1: boolean;
    delta2: boolean;
    delta3: boolean;
    delta4: boolean;
    full: boolean;
  };
}
