# Fantasy Football Banter: The Stats

A static, football-themed site built from the "Fantasy Football Banter – The Stats" spreadsheet.
No build step: open `index.html`, or serve the folder with any static host (`npx serve fantasy-banter`).

- `data.js`: the spreadsheet data (seasons, points, overall ranks, bets). Edit it to add a new season.
- `app.js`: tables, charts, head-to-head, hall of fame and bets, all computed from `data.js`.
- `style.css`: the pitch theme.

Season positions are by points; ties are broken by better overall FPL rank.
