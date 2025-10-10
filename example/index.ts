import { connect } from '@';

const { tools, disconnect } = await connect({
  host: 'localhost',
  port: 2222,
  username: 'dev',
  password: 'dev',
});

const { shellId } = await tools[0].handler({
  command: 'nc -lk 6060',
  run_in_background: true,
});

await new Promise((resolve) => setTimeout(resolve, 5000));

let { stdout, stderr, status, exitCode, signal } = await tools[1].handler({
  shell_id: shellId!,
});

console.log(`stdout:\n${stdout}`);
console.log(`stderr:\n${stderr}`);
console.log(`status: ${status}`);
console.log(`exitCode: ${exitCode}`);
console.log(`signal: ${signal}`);
console.log('--------------------------------');

const { killed } = await tools[2].handler({
  shell_id: shellId!,
});
console.log(`killed: ${killed}`);
console.log('--------------------------------');

({ stdout, stderr, status, exitCode, signal } = await tools[1].handler({
  shell_id: shellId!,
}));

console.log(`stdout:\n${stdout}`);
console.log(`stderr:\n${stderr}`);
console.log(`status: ${status}`);
console.log(`exitCode: ${exitCode}`);
console.log(`signal: ${signal}`);

disconnect();
