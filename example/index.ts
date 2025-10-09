import { connect } from '@';

const tools = await connect({
  host: 'localhost',
  port: 2222,
  username: 'dev',
  password: 'dev',
});

const { shellId } = await tools[0].handler({
  command: 'nc -l 6060',
  run_in_background: true,
});

await new Promise((resolve) => setTimeout(resolve, 30000));

let { stdout, stderr, status, exitCode } = await tools[1].handler({
  shell_id: shellId!,
});

console.log(`stdout:\n${stdout}`);
console.log(`stderr:\n${stderr}`);
console.log(`status:\n${status}`);
console.log(`exitCode:\n${exitCode}`);

const { killed } = await tools[2].handler({
  shell_id: shellId!,
});
console.log(`killed: ${killed}`);

({ stdout, stderr, status, exitCode } = await tools[1].handler({
  shell_id: shellId!,
}));

console.log(`stdout:\n${stdout}`);
console.log(`stderr:\n${stderr}`);
console.log(`status:\n${status}`);
console.log(`exitCode:\n${exitCode}`);
