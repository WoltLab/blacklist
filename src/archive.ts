import * as AdmZip from 'adm-zip';
import fetch from 'node-fetch';

export const sources = new Map<string, string>([
  ['ipv4', 'https://www.stopforumspam.com/downloads/listed_ip_1_all.zip'],
  ['ipv6', 'https://www.stopforumspam.com/downloads/listed_ip_1_ipv6_all.zip'],
  ['email', 'https://www.stopforumspam.com/downloads/listed_email_1_all.zip'],
  [
    'username',
    'https://www.stopforumspam.com/downloads/listed_username_1_all.zip',
  ],
]);

export class Archive {
  public get filename(): string {
    return `tmp.${this.type}.csv`;
  }

  public static getAll(): Archive[] {
    const archives: Archive[] = [];
    sources.forEach(
      (url: string, type: string): void => {
        archives.push(new Archive(type));
      },
    );

    return archives;
  }
  constructor(public readonly type: string) {
    if (!sources.has(this.type)) {
      throw new Error(`The type '${this.type}' is not known.`);
    }
  }

  public async download(): Promise<Buffer | undefined> {
    const response = await fetch(sources.get(this.type));
    if (response.ok) {
      const entries: AdmZip.IZipEntry[] = new AdmZip(
        await response.buffer(),
      ).getEntries();
      for (let i = 0, length = entries.length; i < length; i++) {
        if (/^listed_.+_all\.txt$/.exec(entries[i].name)) {
          return entries[i].getData();
        }
      }
    }

    return undefined;
  }
}
