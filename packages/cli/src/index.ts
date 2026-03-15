import { Command } from 'commander';
import { generateCommand } from './commands/generate';

const program = new Command();

program
  .name('pattern-engine')
  .description('Procedural pattern generator CLI')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate pattern from config file or arguments')
  .option('-c, --config <path>', 'Path to JSON config file')
  .option('-w, --width <number>', 'Width', parseInt)
  .option('-h, --height <number>', 'Height', parseInt)
  .option('-o, --output <path>', 'Output file path', 'output.png')
  .action(generateCommand);

program.parse();