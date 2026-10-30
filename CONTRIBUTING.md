# Contributing

Bug reports and focused improvements are welcome.

For an issue, include your Obsidian version, operating system, One Week version,
reproduction steps, and expected behavior. Use invented example classes and tasks;
do not post private schedules, notes, backups, or account information.

Use Node.js 18 or newer. Run `npm ci`, `npm test`, `npm run check`, and
`npm run build` before opening a pull request. The source entry is `plugin.js`;
the generated `main.js` and `dist/` files are not committed.

Keep the Chinese and English interfaces consistent. Interface translations must
never modify user-provided titles, notes, rooms, teachers, or links. Changes to
storage must preserve existing backups and reject invalid data without deleting it.

Explain the user-visible change and how you checked it in your pull request.
