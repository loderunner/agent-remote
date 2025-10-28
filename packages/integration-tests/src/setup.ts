import { Client, SFTPWrapper } from 'ssh2';

let client: Client;
let sftp: SFTPWrapper;

/**
 * Set up SSH connection to the test sandbox
 */
export async function setupSSH(): Promise<void> {
  client = new Client();
  await new Promise<void>((resolve, reject) => {
    client.on('ready', () => {
      resolve();
    });
    client.on('error', (err) => {
      reject(err);
    });
    client.connect({
      host: 'localhost',
      port: 2222,
      username: 'dev',
      password: 'dev',
    });
  });

  sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
    client.sftp((err, sftpWrapper) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(sftpWrapper);
    });
  });
}

/**
 * Tear down SSH connection
 */
export function teardownSSH(): void {
  sftp.end();
  client.end();
}

/**
 * Get the SSH client for creating tool instances
 */
export function getSSHClient(): Client {
  return client;
}

/**
 * Get the SFTP wrapper for creating tool instances
 */
export function getSSHSFTP(): SFTPWrapper {
  return sftp;
}

/**
 * Get the Docker container name for testing
 */
export function getDockerContainer(): string {
  return 'sandbox';
}

/**
 * Get the Kubernetes pod configuration for testing
 */
export function getK8sConfig(): { pod: string; namespace: string } {
  return {
    pod: 'sandbox',
    namespace: 'default',
  };
}
