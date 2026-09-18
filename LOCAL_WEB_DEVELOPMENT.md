# Local Web Development

Run `start-local-web.cmd` from the repository root to start Agentic Messenger at:

`http://localhost:8081`

The local frontend uses Expo hot reload and the normal hosted Happy backend. It
does not deploy or modify the here.now site. Since localhost has its own browser
storage, pair it with the mobile app once; the local login then persists in Edge.
The launcher starts Expo from `packages/happy-app` and opens the browser after
the app server is ready.

Press `Ctrl+C` in the server window to stop it. Pass another port as the first
argument when 8081 is occupied, for example `start-local-web.cmd 8082`.

Publish to here.now only when a local change has been checked and is ready for
the live site.
