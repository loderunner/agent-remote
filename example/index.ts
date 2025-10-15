import { connect } from '@';

const { tools, disconnect } = await connect({
  host: 'localhost',
  port: 2222,
  username: 'dev',
  password: 'dev',
});

const output = await tools[3].handler({
  pattern: 'error',
  path: '/home/dev/fixtures',
  output_mode: 'content',
});

console.log(output.content[0].text);

const choice: 'yes' | 'no' | undefined =
  Math.random() > 0.9 ? 'yes' : Math.random() > 0.9 ? 'no' : undefined;
switch (choice) {
  case 'yes':
    console.log('yes');
    break;
  case 'no':
    console.log('no');
    break;
  default:
    console.log('default');
    break;
}

disconnect();
