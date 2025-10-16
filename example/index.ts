import fs from 'node:fs/promises';

import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { Client, SFTPWrapper } from 'ssh2';

await fs.copyFile(
  'sandbox/fixtures/benchmark/small.txt',
  'sandbox/fixtures/benchmark/small.tmp.txt',
);

const client = new Client();

await new Promise<void>((resolve, reject) => {
  client.connect({
    host: 'localhost',
    port: 2222,
    username: 'dev',
    password: 'dev',
  });
  client.on('ready', () => {
    resolve();
  });
  client.on('error', (err) => {
    reject(err);
  });
});

const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
  client.sftp((err, sftp) => {
    if (err) {
      reject(err);
      return;
    }
    resolve(sftp);
  });
});

const readStream = sftp.createReadStream(
  '/home/dev/fixtures/benchmark/small.tmp.txt',
  {
    flags: 'r',
    autoClose: true,
    autoDestroy: true,
  },
);
const writeStream = sftp.createWriteStream(
  '/home/dev/fixtures/benchmark/small.tmp.txt',
  {
    flags: 'r+',
    autoClose: true,
    autoDestroy: true,
  },
);

await new Promise<void>((resolve, reject) => {
  readStream.on('data', (data: Buffer) => {
    writeStream.write(data.toString().toUpperCase());
  });
  readStream.on('end', () => {
    console.log('read stream ended');
    writeStream.end();
  });
  readStream.on('close', () => {
    console.log('read stream closed');
  });
  readStream.on('error', (err) => {
    console.log('read stream error');
    console.error(err);
    reject(err);
  });

  writeStream.on('error', (err) => {
    console.log('write stream error');
    console.log(err);
    reject(err);
  });
  writeStream.on('finish', () => {
    console.log('write stream finished');
  });
  writeStream.on('close', () => {
    console.log('write stream closed');
    resolve();
  });
});

sftp.end();
sftp.destroy();
client.end();
client.destroy();
