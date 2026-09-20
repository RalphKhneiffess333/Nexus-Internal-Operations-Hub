#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { spawn } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

const DECISIONS = {
  proceed: "proceed",
  skip: "skip",
  cancel: "cancel",
};

const STAGE_IDS = [
  "prerequisites",
  "dependencies",
  "environment",
  "database",
  "users",
  "tests",
  "start",
];

class SetupCancelled extends Error {
  constructor(message = "Setup cancelled.") {
    super(message);
    this.name = "SetupCancelled";
  }
}

class CommandFailed extends Error {
  constructor(command, code, signal) {
    super(
      `${command} failed${code === null ? "" : ` with exit code ${code}`}.`,
    );
    this.name = "CommandFailed";
    this.command = command;
    this.code = code;
    this.signal = signal;
  }
}

function section(step, title) {
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(` Nexus Setup`);
  console.log(` Step ${step} of ${STAGE_IDS.length} — ${title}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

function success(message) {
  console.log(`✓ ${message}`);
}

function warning(message) {
  console.log(`⚠ ${message}`);
}

function failure(message) {
  console.error(`✗ ${message}`);
}

function info(message = "") {
  console.log(message);
}

function highlightSelected(text) {
  return `\x1B[7m ${text} \x1B[0m`;
}

function dim(text) {
  return `\x1B[2m${text}\x1B[0m`;
}

function getStageIds() {
  return [...STAGE_IDS];
}

function normalizeDecision(input, choices) {
  const answer = input.trim().toLowerCase();
  if (!answer) {
    return null;
  }

  const matchedByNumber = choices[Number(answer) - 1];
  if (matchedByNumber) {
    return matchedByNumber.value;
  }

  return (
    choices.find((choice) => {
      const label = choice.label.toLowerCase();
      return label === answer || label.startsWith(answer);
    })?.value ?? null
  );
}

function wrapSelectionIndex(index, length) {
  if (length <= 0) {
    return 0;
  }

  return ((index % length) + length) % length;
}

function decisionEffect(decision) {
  if (decision === DECISIONS.cancel) {
    return "cancel";
  }

  if (decision === DECISIONS.skip) {
    return "skip";
  }

  return "run";
}

function promptChoice(question, choices) {
  if (
    !process.stdin.isTTY ||
    !process.stdout.isTTY ||
    !process.stdin.setRawMode
  ) {
    return promptChoiceByText(question, choices);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let selectedIndex = 0;
    const menuLineCount = choices.length + 1;

    const finish = (error, value) => {
      if (settled) {
        return;
      }
      settled = true;
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("keypress", onKeypress);
      process.stdout.write("\x1B[?25h");
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };

    const renderMenu = () => {
      choices.forEach((choice, index) => {
        if (index === selectedIndex) {
          process.stdout.write(`› ${highlightSelected(choice.label)}\n`);
        } else {
          process.stdout.write(`  ${choice.label}\n`);
        }
      });
      process.stdout.write(
        `${dim("Use ↑/↓ to move, Enter to select, Ctrl+C to cancel.")}\n`,
      );
    };

    const rerenderMenu = () => {
      readline.moveCursor(process.stdout, 0, -menuLineCount);
      readline.cursorTo(process.stdout, 0);
      readline.clearScreenDown(process.stdout);
      renderMenu();
    };

    const clearMenu = () => {
      readline.moveCursor(process.stdout, 0, -menuLineCount);
      readline.cursorTo(process.stdout, 0);
      readline.clearScreenDown(process.stdout);
    };

    const onKeypress = (_character, key = {}) => {
      if (key.ctrl && key.name === "c") {
        clearMenu();
        finish(new SetupCancelled());
        return;
      }

      if (key.name === "up") {
        selectedIndex = wrapSelectionIndex(selectedIndex - 1, choices.length);
        rerenderMenu();
        return;
      }

      if (key.name === "down") {
        selectedIndex = wrapSelectionIndex(selectedIndex + 1, choices.length);
        rerenderMenu();
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        const choice = choices[selectedIndex];
        clearMenu();
        info(`✓ ${choice.label}`);
        finish(null, choice.value);
      }
    };

    info("");
    info(question);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("keypress", onKeypress);
    process.stdout.write("\x1B[?25l");
    renderMenu();
  });
}

function promptChoiceByText(question, choices) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let settled = false;

    const finish = (error, value) => {
      if (settled) {
        return;
      }
      settled = true;
      rl.close();
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };

    rl.on("SIGINT", () => finish(new SetupCancelled()));

    const ask = () => {
      info("");
      info(question);
      choices.forEach((choice, index) => {
        info(`  ${index + 1}. ${choice.label}`);
      });

      rl.question("Choose an option: ", (answer) => {
        const decision = normalizeDecision(answer, choices);
        if (decision) {
          finish(null, decision);
          return;
        }

        warning("Please choose one of the listed options.");
        ask();
      });
    };

    ask();
  });
}

async function askStageDecision(question, { allowSkip = true } = {}) {
  const choices = [{ label: "Proceed", value: DECISIONS.proceed }];
  if (allowSkip) {
    choices.push({ label: "Skip", value: DECISIONS.skip });
  }
  choices.push({ label: "Cancel", value: DECISIONS.cancel });

  const decision = await promptChoice(question, choices);
  const effect = decisionEffect(decision);
  if (effect === "cancel") {
    throw new SetupCancelled();
  }
  return effect;
}

async function askDoneOrCancel(question) {
  const decision = await promptChoice(question, [
    { label: "Done", value: "done" },
    { label: "Cancel", value: DECISIONS.cancel },
  ]);

  if (decision === DECISIONS.cancel) {
    throw new SetupCancelled();
  }
}

function commandToString(command, args) {
  return [command, ...args].join(" ");
}

function getNpmInvocation(args) {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...args],
      shell: false,
    };
  }

  return {
    command: npmExecutable,
    args,
    shell: process.platform === "win32",
  };
}

function runCommand(args, options = {}) {
  const invocation = options.command
    ? { command: options.command, args, shell: false }
    : getNpmInvocation(args);
  const command = invocation.command;
  const commandArgs = invocation.args;
  const commandText = options.label ?? commandToString(command, args);
  const cwd = options.cwd ?? repoRoot;

  return new Promise((resolve, reject) => {
    let interrupted = false;
    let child;
    try {
      child = spawn(command, commandArgs, {
        cwd,
        stdio: options.stdio ?? "inherit",
        shell: invocation.shell,
        env: process.env,
      });
    } catch (error) {
      error.command = commandText;
      reject(error);
      return;
    }

    const onSigint = () => {
      interrupted = true;
      if (!child.killed) {
        child.kill("SIGINT");
      }
    };

    process.once("SIGINT", onSigint);

    child.on("error", (error) => {
      process.removeListener("SIGINT", onSigint);
      error.command = commandText;
      reject(error);
    });

    child.on("close", (code, signal) => {
      process.removeListener("SIGINT", onSigint);
      if (interrupted) {
        if (options.resolveOnSigint) {
          resolve();
          return;
        }
        reject(new SetupCancelled());
        return;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(new CommandFailed(commandText, code, signal));
    });
  });
}

function runCommandCapture(args, options = {}) {
  const invocation = options.command
    ? { command: options.command, args, shell: false }
    : getNpmInvocation(args);
  const command = invocation.command;
  const commandArgs = invocation.args;
  const cwd = options.cwd ?? repoRoot;

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, commandArgs, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        shell: invocation.shell,
        env: process.env,
      });
    } catch (error) {
      resolve({ ok: false, error });
      return;
    }

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ ok: false, error });
    });
    child.on("close", (code, signal) => {
      resolve({ ok: code === 0, code, signal, stdout, stderr });
    });
  });
}

function isNodeVersionSupported(version) {
  const major = Number(String(version).split(".")[0]);
  return Number.isFinite(major) && major >= 20;
}

function getPrerequisiteReport({ nodeVersion, npmOk, postgresOk }) {
  return [
    {
      name: "Node.js v20+",
      ok: isNodeVersionSupported(nodeVersion),
      required: true,
    },
    {
      name: "npm",
      ok: Boolean(npmOk),
      required: true,
    },
    {
      name: "PostgreSQL tools/server availability",
      ok: Boolean(postgresOk),
      required: false,
    },
  ];
}

async function checkPrerequisites() {
  const npmCheck = await runCommandCapture(["--version"]);
  const pgReadyCheck = await runCommandCapture(["--version"], {
    command: process.platform === "win32" ? "pg_isready.exe" : "pg_isready",
  });
  const psqlCheck = pgReadyCheck.ok
    ? pgReadyCheck
    : await runCommandCapture(["--version"], {
        command: process.platform === "win32" ? "psql.exe" : "psql",
      });

  const report = getPrerequisiteReport({
    nodeVersion: process.versions.node,
    npmOk: npmCheck.ok,
    postgresOk: psqlCheck.ok,
  });

  for (const item of report) {
    const marker = item.ok ? "✓" : item.required ? "✗" : "⚠";
    info(`${marker} ${item.name}${item.ok ? " detected" : " not verified"}`);
  }

  const missingRequired = report.filter((item) => item.required && !item.ok);
  if (missingRequired.length > 0) {
    throw new Error(
      `Install or fix ${missingRequired.map((item) => item.name).join(", ")} before continuing.`,
    );
  }

  if (!psqlCheck.ok) {
    warning(
      "PostgreSQL could not be verified from the CLI. You can continue if you use Docker, a remote database, or another managed local setup.",
    );
  }
}

function parseEnvFile(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    values[key] = value;
  }
  return values;
}

function evaluateEnvValues(requiredKeys, values) {
  return requiredKeys.map((key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      return { key, status: "missing" };
    }

    if (!values[key]) {
      return { key, status: "empty" };
    }

    return { key, status: "configured" };
  });
}

function getEnvFileState(targetPath, examplePath, exists = fs.existsSync) {
  return {
    targetPath,
    examplePath,
    exists: exists(targetPath),
    hasExample: exists(examplePath),
  };
}

function ensureFileFromExample(targetPath, examplePath) {
  const state = getEnvFileState(targetPath, examplePath);
  if (state.exists) {
    return "exists";
  }

  if (!state.hasExample) {
    return "missing-example";
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(examplePath, targetPath, fs.constants.COPYFILE_EXCL);
  return "created";
}

function printEnvStatus(filePath, requiredKeys) {
  if (!fs.existsSync(filePath)) {
    warning(`${path.relative(repoRoot, filePath)} does not exist yet.`);
    return;
  }

  const values = parseEnvFile(fs.readFileSync(filePath, "utf8"));
  for (const item of evaluateEnvValues(requiredKeys, values)) {
    if (item.status === "configured") {
      success(`${item.key} is configured`);
    } else if (item.status === "empty") {
      warning(`${item.key} exists but is empty`);
    } else {
      failure(`${item.key} is missing`);
    }
  }
}

function formatCommandFailure(error) {
  if (error instanceof CommandFailed) {
    return `${error.command} failed${error.code === null ? "" : ` with exit code ${error.code}`}.`;
  }

  if (error?.command) {
    return `${error.command} could not be started. ${error.message}`;
  }

  return error instanceof Error ? error.message : String(error);
}

async function runPrerequisitesStage() {
  section(1, "Prerequisites");
  info("Before setup continues, make sure these prerequisites are available:");
  info("- Node.js v20+");
  info("- npm");
  info(
    "- PostgreSQL installed and running, or access to a database you can create/use",
  );
  info(
    "- A Microsoft organization / Entra tenant if you intend to test authentication",
  );
  info("- Optional: an API client such as Postman");
  info("");
  info(
    "Microsoft Entra authentication requires an app registration and credentials.",
  );

  const effect = await askStageDecision(
    "Prerequisites need to be installed and PostgreSQL should be available before continuing. How would you like to proceed?",
  );
  if (effect === "skip") {
    warning(
      "Prerequisite validation skipped. Later command failures will still be reported normally.",
    );
    return;
  }

  await checkPrerequisites();
  success("Prerequisite check completed");
}

async function runDependenciesStage() {
  section(2, "Install Dependencies");
  const rootModules = fs.existsSync(path.join(repoRoot, "node_modules"));
  const backendModules = fs.existsSync(
    path.join(repoRoot, "backend", "node_modules"),
  );
  const frontendModules = fs.existsSync(
    path.join(repoRoot, "frontend", "nexus", "node_modules"),
  );

  if (rootModules && backendModules && frontendModules) {
    info(
      "Existing node_modules folders were detected for the root, backend, and frontend.",
    );
  }

  const effect = await askStageDecision(
    "The next step will install the root, backend, and frontend dependencies. This may take a few minutes. Continue?",
  );
  if (effect === "skip") {
    warning("Dependency installation skipped");
    return;
  }

  await runCommand(["install"], { label: "npm install" });
  success("Dependencies installed");
}

async function runEnvironmentStage() {
  section(3, "Environment Configuration");
  info("The backend has two separate environment profiles:");
  info("");
  info("backend/.env — your normal local application");
  info("  Used by npm run start, npm run db:setup, and npm run seed:users.");
  info(
    "  Point it at your normal local database and add the real Microsoft Entra credentials used for sign-in.",
  );
  info("");
  info("backend/.env.integration — automated tests and test mode");
  info(
    "  Used by npm run test and npm run start:test instead of backend/.env.",
  );
  info(
    "  Point it at a separate PostgreSQL database: test startup applies migrations, seeds fixed test users, and may reset test data.",
  );
  info(
    "  Its Microsoft Entra values can remain test placeholders because test authentication does not contact Microsoft.",
  );
  info("");
  warning(
    "Never use the same database in both files. Test mode refuses to start when their DATABASE_URL values match.",
  );
  info(
    "Both files use the same variable names, but each command loads only the profile it needs.",
  );
  info(
    "Templates are available at backend/.env.example and backend/.env.integration.example.",
  );
  info(
    "The frontend can optionally use frontend/nexus/.env from frontend/nexus/.env.example.",
  );
  info("");
  info("Backend PostgreSQL variables:");
  info(
    "DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD, DATABASE_URL",
  );
  info("");
  info("Microsoft Entra variables:");
  info(
    "MICROSOFT_ENTRA_TENANT_ID, MICROSOFT_ENTRA_CLIENT_ID, MICROSOFT_ENTRA_CLIENT_SECRET,",
  );
  info("MICROSOFT_ENTRA_REDIRECT_URI, MICROSOFT_ENTRA_SCOPES, FRONTEND_URL");
  info("");
  info(
    "Local redirect URI: http://localhost:3000/authentication/microsoft/callback",
  );
  info("Default frontend URL: http://localhost:5173");
  info("Default scopes: openid profile email");
  info("You need an Entra app registration with the redirect URI configured.");
  info(
    "Eurisko Academy instructors can check their Week 3 email for identity provider credentials.",
  );

  const effect = await askStageDecision(
    "Would you like this wizard to create missing .env files from the examples and then wait while you configure them?",
  );
  if (effect === "skip") {
    warning("Environment configuration skipped");
    return;
  }

  const files = [
    ["backend/.env", "backend/.env.example"],
    ["backend/.env.integration", "backend/.env.integration.example"],
    ["frontend/nexus/.env", "frontend/nexus/.env.example"],
  ];

  for (const [target, example] of files) {
    const result = ensureFileFromExample(
      path.join(repoRoot, target),
      path.join(repoRoot, example),
    );

    if (result === "created") {
      success(`Created ${target} from ${example}`);
    } else if (result === "exists") {
      success(`${target} already exists; it was not overwritten`);
    } else {
      warning(`${example} is missing, so ${target} was not created`);
    }
  }

  info("");
  info("Open the environment files now and fill in your local values.");
  info("Secret values will not be printed by this wizard.");
  printEnvStatus(path.join(repoRoot, "backend", ".env"), [
    "DATABASE_HOST",
    "DATABASE_PORT",
    "DATABASE_NAME",
    "DATABASE_USER",
    "DATABASE_PASSWORD",
    "DATABASE_URL",
    "MICROSOFT_ENTRA_TENANT_ID",
    "MICROSOFT_ENTRA_CLIENT_ID",
    "MICROSOFT_ENTRA_CLIENT_SECRET",
    "MICROSOFT_ENTRA_REDIRECT_URI",
    "MICROSOFT_ENTRA_SCOPES",
    "FRONTEND_URL",
  ]);

  await askDoneOrCancel(
    "Have you finished configuring the required environment variables?",
  );
  success("Environment configuration acknowledged");
}

async function runDatabaseStage() {
  section(4, "Database Setup");
  info(
    "This step will apply the Prisma migrations and seed the database with the initial identity provider, departments, and sample data.",
  );
  info("It does not wipe existing tickets.");

  const effect = await askStageDecision(
    "Would you like to run npm run db:setup now?",
  );
  if (effect === "skip") {
    warning("Database setup skipped");
    return;
  }

  await runCommand(["run", "db:setup"], { label: "npm run db:setup" });
  success("Database initialized");
}

async function runUsersStage() {
  section(5, "Application Users");
  info("Upon login, user accounts are automatically created as employees.");
  info(
    "If you need an admin or agent, the existing interactive user CLI can add or modify users, roles, and departments.",
  );
  info("Command: npm run seed:users");

  const effect = await askStageDecision(
    "Would you like to add or modify application users now?",
  );
  if (effect === "skip") {
    warning("User seeding skipped");
    return;
  }

  await runCommand(["run", "seed:users"], { label: "npm run seed:users" });
  success("User seeding CLI completed");
}

async function runTestsStage() {
  section(6, "Run Tests");
  info(
    "The backend test suite requires PostgreSQL. It applies Prisma migrations to the database in backend/.env.integration before seeding.",
  );
  info(
    "Running it now verifies that the environment is working before starting the application.",
  );

  const effect = await askStageDecision(
    "Would you like to run npm run test now?",
  );
  if (effect === "skip") {
    warning("Tests skipped");
    return;
  }

  await runCommand(["run", "test"], { label: "npm run test" });
  success("Tests passed");
}

async function runBulkSeedStage() {
  const choice = await promptChoice(
    "Would you like to populate a database with synthetic bulk load-test data before the app starts?",
    [
      {
        label: "Skip bulk seeding",
        value: DECISIONS.skip,
      },
      {
        label: "Normal database (npm run seed:bulk)",
        value: "normal",
      },
      {
        label: "Test database (npm run seed:bulk:test)",
        value: "test",
      },
      {
        label: "Both databases",
        value: "both",
      },
      {
        label: "Cancel setup",
        value: DECISIONS.cancel,
      },
    ],
  );

  if (choice === DECISIONS.cancel) {
    throw new SetupCancelled();
  }
  if (choice === DECISIONS.skip) {
    info("Bulk seeding skipped");
    return;
  }

  const jobs =
    choice === "both"
      ? [
          { label: "npm run seed:bulk", script: "seed:bulk" },
          { label: "npm run seed:bulk:test", script: "seed:bulk:test" },
        ]
      : [
          {
            label: choice === "test" ? "npm run seed:bulk:test" : "npm run seed:bulk",
            script: choice === "test" ? "seed:bulk:test" : "seed:bulk",
          },
        ];
  const failures = [];

  for (const job of jobs) {
    info("");
    info(`Running ${job.label}...`);
    try {
      await runCommand(["run", job.script], { label: job.label });
      success(`${job.label} completed`);
    } catch (error) {
      if (error instanceof SetupCancelled) {
        throw error;
      }
      failures.push({ ...job, error });
      failure(formatCommandFailure(error));
      warning("The remaining selected bulk seed targets will still be attempted.");
    }
  }

  if (failures.length === 0) {
    return;
  }

  const nextStep = await promptChoice(
    "One or more bulk seed commands failed. What would you like to do next?",
    [
      {
        label: "Continue to app startup",
        value: "continue",
      },
      {
        label: "Cancel setup",
        value: DECISIONS.cancel,
      },
    ],
  );
  if (nextStep === DECISIONS.cancel) {
    throw new SetupCancelled();
  }
  warning("Continuing without a complete bulk seed.");
}

async function runStartStage() {
  section(7, "Start Application");
  info(
    "Normal mode uses backend/.env, your configured application database, and Microsoft Entra sign-in.",
  );
  info(
    "Choose it to verify the real authentication flow or work with your normal local application data.",
  );
  info("");
  info(
    "Test mode uses backend/.env.integration, applies pending migrations, seeds seven test users, and enables test-only login and session-cookie helpers.",
  );
  info(
    "Choose it for safe development, quick role switching, or API testing without Microsoft accounts.",
  );
  info(
    "The setup refuses to start test mode if its database matches the normal database.",
  );

  const startMode = await promptChoice(
    "The repository is configured. Which startup mode fits what you want to test?",
    [
      {
        label:
          "Normal — real Microsoft sign-in and application database (npm run start)",
        value: "normal",
      },
      {
        label:
          "Test — isolated database, seeded users, and auth bypass (npm run start:test)",
        value: "test",
      },
      {
        label: "Finish setup without starting the app",
        value: DECISIONS.skip,
      },
      {
        label: "Cancel setup",
        value: DECISIONS.cancel,
      },
    ],
  );

  if (startMode === DECISIONS.cancel) {
    throw new SetupCancelled();
  }

  if (startMode === DECISIONS.skip) {
    info("");
    info("Nexus setup completed.");
    info("");
    info("Start the application normally with:");
    info("");
    info("npm run start");
    info("");
    info("Or start with the integration database and test users with:");
    info("");
    info("npm run start:test");
    info("");
    info("Backend:  http://localhost:3000");
    info("Frontend: http://localhost:5173");
    return;
  }

  await runBulkSeedStage();

  const scriptName = startMode === "test" ? "start:test" : "start";
  const modeDescription = startMode === "test" ? " in test mode" : "";
  info(
    `Starting Nexus${modeDescription}. Press Ctrl+C to stop the backend and frontend.`,
  );
  await runCommand(["run", scriptName], {
    label: `npm run ${scriptName}`,
    resolveOnSigint: true,
  });
}

async function runSetup() {
  info("Welcome to the Nexus setup wizard.");
  info("");
  info(
    "This wizard will help you install dependencies, configure your local environment, prepare PostgreSQL, optionally seed users and bulk load-test data, run tests, and start the application.",
  );
  info("");
  info(
    "You can skip optional steps at any time, or cancel the setup entirely.",
  );

  await runPrerequisitesStage();
  await runDependenciesStage();
  await runEnvironmentStage();
  await runDatabaseStage();
  await runUsersStage();
  await runTestsStage();
  await runStartStage();
}

if (require.main === module) {
  runSetup().catch((error) => {
    if (error instanceof SetupCancelled) {
      info("");
      info("Setup cancelled.");
      process.exitCode = 0;
      return;
    }

    info("");
    failure(formatCommandFailure(error));
    process.exitCode =
      error instanceof CommandFailed && error.code ? error.code : 1;
  });
}

module.exports = {
  CommandFailed,
  DECISIONS,
  SetupCancelled,
  decisionEffect,
  evaluateEnvValues,
  formatCommandFailure,
  getEnvFileState,
  getPrerequisiteReport,
  getStageIds,
  isNodeVersionSupported,
  normalizeDecision,
  parseEnvFile,
  highlightSelected,
  wrapSelectionIndex,
};
