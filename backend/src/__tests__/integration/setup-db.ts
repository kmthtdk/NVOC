import { execFileSync, execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Vitest globalSetup for the integration suite.
 *
 * The unit suite mocks every repo, so not one line of SQL in this codebase has
 * ever executed under test. These tests run against a real MySQL 8.4 — the same
 * image docker-compose uses — because the bugs worth catching here (transaction
 * rollback, the FOR UPDATE code counter, ENUM/NOT NULL violations, the approval
 * gate) are precisely the ones a mocked repo cannot see.
 */
const CONTAINER = 'voc_itest_db';
const PORT = '33061';
const DB = 'voc_test';

const INIT_DIR = path.resolve(process.cwd(), '../database/init');

function docker(args: string[]): string {
  // 'pipe' so a failed `rm -f` on a container that was never there stays quiet
  // instead of printing to the test output.
  return execFileSync('docker', args, { encoding: 'utf8', stdio: 'pipe' });
}

/** The container reports "ready" once during its own init, then restarts. */
function waitForRealReady(): void {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const logs = execSync(`docker logs ${CONTAINER} 2>&1`, { encoding: 'utf8' });
      if (/ready for connections.*port: 3306/.test(logs)) return;
    } catch {
      /* container still starting */
    }
    execSync('node -e "setTimeout(()=>{},1500)"'); // ~1.5s pause without a sleep binary
  }
  throw new Error(`MySQL container ${CONTAINER} never became ready`);
}

export async function setup(): Promise<void> {
  try {
    docker(['rm', '-f', CONTAINER]);
  } catch {
    /* not running */
  }

  docker([
    'run', '-d', '--name', CONTAINER,
    '-e', 'MYSQL_ALLOW_EMPTY_PASSWORD=1',
    '-e', `MYSQL_DATABASE=${DB}`,
    '-p', `${PORT}:3306`,
    'mysql:8.4',
  ]);

  waitForRealReady();

  // Load the real schema + seed, in filename order, exactly as the compose
  // entrypoint does. If these break, the tests break — which is the point.
  for (const file of readdirSync(INIT_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(path.join(INIT_DIR, file), 'utf8');
    execFileSync('docker', ['exec', '-i', CONTAINER, 'mysql', '-uroot', DB], { input: sql });
  }
}

export async function teardown(): Promise<void> {
  try {
    docker(['rm', '-f', CONTAINER]);
  } catch {
    /* already gone */
  }
}
