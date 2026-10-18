/** `--name value` and `--flag` arguments, which is all these scripts need. */
export function args(argv = process.argv.slice(2)): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else out[key] = true;
  }
  return out;
}

export function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Set ${name} first (see .env.example).`);
    process.exit(1);
  }
  return v;
}

export function run(main: () => Promise<void>): void {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
