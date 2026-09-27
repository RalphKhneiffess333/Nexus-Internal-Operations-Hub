#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const { spawn } = require('node:child_process');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function getNpmInvocation(args) {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...args],
      shell: false,
    };
  }

  return {
    command: npmCommand,
    args,
    shell: process.platform === 'win32',
  };
}

function runNpm(args, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${label}`);
    const invocation = getNpmInvocation(args);
    const child = spawn(invocation.command, invocation.args, {
      cwd: backendRoot,
      env: process.env,
      shell: invocation.shell,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${label} failed${signal ? ` because of ${signal}` : ` with exit code ${code}`}.`,
        ),
      );
    });
  });
}

function askToProvisionUser() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(
      '\nNon-interactive terminal detected; skipping optional user provisioning.',
    );
    return Promise.resolve(false);
  }

  const interfaceInstance = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    interfaceInstance.question(
      '\nWould you like to add or modify an application user now? [y/N] ',
      (answer) => {
        interfaceInstance.close();
        resolve(['y', 'yes'].includes(answer.trim().toLowerCase()));
      },
    );
  });
}

async function deploy() {
  console.log('Nexus backend deployment workflow');
  console.log('Using backend/.env for the application database and settings.');

  await runNpm(['run', 'build'], 'npm run build');
  await runNpm(
    ['run', 'prisma:migrate'],
    'npm run prisma:migrate (apply pending migrations)',
  );
  await runNpm(
    ['run', 'prisma:seed'],
    'npm run prisma:seed (seed baseline application data)',
  );

  if (await askToProvisionUser()) {
    await runNpm(
      ['run', 'seed:users'],
      'npm run seed:users (interactive user administration)',
    );
  }

  await runNpm(
    ['run', 'test'],
    'npm run test (tests use backend/.env.integration)',
  );

  console.log('\nDeployment checks passed. Starting the production backend.');
  await runNpm(['run', 'start:prod'], 'npm run start:prod');
}

deploy().catch((error) => {
  console.error(`\nBackend deployment stopped: ${error.message}`);
  process.exitCode = 1;
});
