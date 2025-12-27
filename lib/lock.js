import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import pc from 'picocolors';

/**
 * Acquire a process lock for a specific scope (e.g. 'web', 'tui')
 * Returns true if acquired, false if already locked by another ALIVE process.
 */
export function acquireLock(scope, force = false) {
    const lockFile = join(process.cwd(), '.gta', `${scope}.lock`);

    try {
        if (force) {
            if (existsSync(lockFile)) rmSync(lockFile, { force: true });
        } else if (existsSync(lockFile)) {
            const content = readFileSync(lockFile, 'utf-8');
            try {
                const { pid, info } = JSON.parse(content);
                // Check if process is alive
                process.kill(pid, 0);

                // If we got here, process is alive
                return {
                    acquired: false,
                    pid,
                    info
                };
            } catch (e) {
                // Process is dead or file is corrupt, cleanup and continue
                // console.log(pc.yellow(`   Removing stale ${scope} lock file...`));
                rmSync(lockFile, { force: true });
            }
        }

        // Write new lock
        const dir = dirname(lockFile);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

        const lockData = {
            pid: process.pid,
            timestamp: new Date().toISOString(),
            info: scope === 'web' ? 'GTA Web Interface' : 'GTA TUI Mode'
        };

        writeFileSync(lockFile, JSON.stringify(lockData, null, 2));

        return { acquired: true };

    } catch (e) {
        // Error interacting with fs, assume we can proceed or fail safe?
        // Failing safe usually means letting it run if lock checking fails, but logging error
        console.error(pc.red(`Failed to check lock: ${e.message}`));
        return { acquired: true }; // Proceed with caution
    }
}

/**
 * Release the lock
 */
export function releaseLock(scope) {
    const lockFile = join(process.cwd(), '.gta', `${scope}.lock`);
    try {
        if (existsSync(lockFile)) {
            // Only remove if it's OUR PID? Or just remove it.
            // Ideally check PID, but simpler to just remove if we are shutting down.
            const content = readFileSync(lockFile, 'utf-8');
            const { pid } = JSON.parse(content);
            if (pid === process.pid) {
                rmSync(lockFile, { force: true });
            }
        }
    } catch (e) {
        // ignore
    }
}
