import { writeFile } from 'node:fs/promises';
import { validateStagingUrl } from './staging-target.mjs';
const file = 'C:/Users/Usuario/Zytrix-Export-Privado/neon-staging.connection';
if (!process.stdin.isTTY) throw new Error('An interactive terminal is required');
process.stdout.write('Cole a Connection string direta de staging e pressione Enter. Entrada oculta.\r\n');
process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
let value = '';
process.stdin.on('data', async chunk => {
  chunk = chunk.replace(/\x1b\[(?:200|201)~/g, '');
  if (chunk.includes('\u0003')) { process.stdin.setRawMode(false); process.exit(1); }
  for (const char of chunk) {
    if (char === '\r' || char === '\n') {
      process.stdin.removeAllListeners('data');
      process.stdin.setRawMode(false);
      process.stdin.pause();
      try {
        let connection = value.trim();
        // Neon may copy a psql command. Extract its single URL without executing it.
        const command = connection.match(/^psql\s+(['"])(postgres(?:ql)?:\/\/[^\r\n]+)\1$/);
        if (command) connection = command[2];
        validateStagingUrl(connection);
        await writeFile(file, connection, { flag: 'wx', mode: 0o600 });
        process.stdout.write('\r\nConexao salva somente na pasta privada local.\r\n');
      } catch {
        process.stdout.write('\r\nNao foi salvo: conexao invalida ou arquivo ja existente.\r\n');
        process.exitCode = 1;
      }
      value = '';
      return;
    }
    if (char === '\u007f' || char === '\b') value = value.slice(0,-1);
    else if (char >= ' ' && char !== '\u007f') value += char;
  }
});
