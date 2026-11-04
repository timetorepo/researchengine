## 1.0.0-release — the first full release: Composio connects inside the app

- **Apps connect inside Research Engine.** Press *Connect* on an app in Connectors. Composio's sign-in opens in a small window, and the app shows it as connected when you finish. Disconnect from the same list.
- **Your Composio key is recognised.** The project key (`ak_…`) works. A Connect consumer key (`ck_…`) is named as the wrong key, with where to find the right one.
- **The app list loads.** Live apps are no longer hidden by a field that Composio sends as an object. The catalog loads in one request, and checking the key warms it up.
- **One Composio identity.** Save your Composio user id in Connectors. Connections are filed under it. The Automatic identity is gone.

Installers: `Research.Engine_1.0.0-release_x64-setup.exe` and `Research.Engine_1.0.0-release_amd64.deb`. Digests are in `downloads/INSTALLERS.sha256`.

Upgrade: nothing to migrate. Saved bots, chats, projects and settings are kept. Connections made under the old automatic id on this device do not show; save your Composio user id and connect the apps again.
