import type { GrepInput, GrepOutput } from '@agent-remote/core';
import { grepInputSchema } from '@agent-remote/core';
import { Client } from 'ssh2';

export class GrepTool {
  constructor(private readonly client: Client) {}

  public async grep(input: GrepInput): Promise<GrepOutput> {
    grepInputSchema.parse(input);

    const args: string[] = ['grep', '-r'];

    if (input.glob) {
      args.push('--include', JSON.stringify(input.glob));
    }

    if (input.output_mode === 'content') {
      if (input['-B'] !== undefined) {
        args.push('-B', Math.trunc(input['-B']).toString());
      }
      if (input['-A'] !== undefined) {
        args.push('-A', Math.trunc(input['-A']).toString());
      }
      if (input['-C'] !== undefined) {
        args.push('-C', Math.trunc(input['-C']).toString());
      }
      if (input['-n']) {
        args.push('-n');
      }
    } else if (input.output_mode !== 'count') {
      args.push('-l');
    }

    if (input['-i']) {
      args.push('-i');
    }

    args.push(JSON.stringify(input.pattern), JSON.stringify(input.path));

    if (input.head_limit) {
      args.push(`| head -${Math.trunc(input.head_limit)}`);
    }

    if (input.output_mode === 'count') {
      args.push('| wc -l');
    }

    const command = args.join(' ');

    return new Promise<GrepOutput>((resolve, reject) => {
      this.client.exec(command, (err, channel) => {
        if (err) {
          reject(err);
          return;
        }
        let output = '';
        channel.on('data', (data: Buffer) => {
          output += data.toString();
        });
        channel.on('error', (err: unknown) => {
          reject(err);
        });
        channel.on('close', () => {
          output = output.trim();
          switch (input.output_mode) {
            case 'content':
              resolve({
                mode: 'content',
                content: output,
                numLines: output === '' ? 0 : output.split('\n').length,
              });
              break;
            case 'count':
              resolve({
                mode: 'count',
                numMatches: output === '' ? 0 : Number.parseInt(output),
              });
              break;
            case 'files_with_matches':
            default:
              {
                const filenames = output === '' ? [] : output.split('\n');
                resolve({
                  mode: 'files_with_matches',
                  numFiles: filenames.length,
                  filenames,
                });
              }
              break;
          }
        });
      });
    });
  }
}
