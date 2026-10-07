// Local preview in prototype mode: no Supabase (empty URL/key), so the passenger and
// driver flows run on mock data without signing in. Mapbox/HERE keys still load from .env.
const { spawn } = require('child_process');
const path = require('path');

const env = { ...process.env, EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' };
const cli = path.join(__dirname, '..', 'node_modules', 'expo', 'bin', 'cli');
const child = spawn(process.execPath, [cli, 'start', '--web', '--port', '8083', '--clear'], { cwd: path.join(__dirname, '..'), env, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
