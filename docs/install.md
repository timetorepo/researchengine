# Installing Research Engine

Every method below runs the same product, with the same library. Pick the first
one that matches your situation — you can always switch later, because your data
lives in its own folder and follows you.

**Research Engine runs on Windows, Linux and any modern browser. There is no
macOS build yet.**

| Method | Weight | Where it runs | Best for |
|---|---|---|---|
| [A. Desktop app](#a-desktop-app) | light | Windows · Linux | The everyday way: install once, open it like any program |
| [B. Portable folder](#b-portable-folder) | light | Windows · Linux, Node 20+ | No installer, no admin rights, one folder you can move |
| [C. Browser (PWA)](#c-browser-pwa) | none to install | Chrome, Edge, Brave, Arc | Trying it in a minute, or using a copy someone else hosts |
| [D. Docker, one container](#d-docker-one-container) | heavier | Any Docker host | Homes and labs that already run containers |
| [E. Docker Compose](#e-docker-compose) | heavier | Any Docker host | Adding a private search service alongside the app |
| [F. Home server or NAS](#f-home-server-or-nas) | varies | Synology, Unraid, TrueNAS, a spare PC | One library the whole household reaches from anywhere |
| [G. From source](#g-from-source) | for tinkerers | Anywhere Node 20+ runs | Contributing, or building your own release |

Whichever you choose, the app is the same and your work is stored in **one
folder** on the machine running it — `~/.research-engine` on Linux
(`%USERPROFILE%\.research-engine` on Windows), or the `re-data` volume in
Docker. Back it up by copying it.

---

## A. Desktop app

**What it is.** A normal desktop program with its own window, wrapping the whole
Research Engine engine — no Node.js, no Electron and no separate browser needed
on your machine.

**The easy way.** Open the [latest release](https://github.com/timetorepo/researchengine/releases)
and download the file for your system:

| Your system | File | Then |
|---|---|---|
| Windows 10/11 (x64) | `Research.Engine_<version>_x64-setup.exe` | Run it. No administrator password is needed; it installs for your user, adds a Start-menu entry and an uninstaller. If your machine does not already have Microsoft's WebView2, the installer brings it. |
| Linux (x64) | `Research.Engine_<version>_amd64.deb` | `sudo apt install ./Research.Engine_<version>_amd64.deb`, then launch it from your applications menu |
| Linux (x64), no install | `Research.Engine_<version>_amd64.AppImage` | `chmod +x Research.Engine_<version>_amd64.AppImage && ./Research.Engine_<version>_amd64.AppImage` |

**Verify before you run.** Each release lists the SHA-256 fingerprint of every
installer exactly as GitHub recorded it. Compare it with your download:

```bash
sha256sum Research.Engine_<version>_amd64.AppImage      # Linux
certutil -hashfile Research.Engine_<version>_x64-setup.exe SHA256   # Windows
```

**How it starts.** The window looks for a Research Engine server on
`127.0.0.1:3847` and reuses one if it is already running; otherwise it starts its
own, waits until that server actually answers, and only then shows the window.
When you close the window, that server stops with it.

**Your data.** The same `~/.research-engine` folder the portable and browser
builds use, so the desktop app, a browser tab and a portable copy on one machine
all read the same library. Deleting the app never deletes your data.

**Changing the port:** set `RE_DESKTOP_PORT` if something else already uses 3847.

**Building the installer yourself:** see [development.md](development.md).

**Not included (yet).** No tray icon, no global hotkey, and no macOS build.

---

## B. Portable folder

**What it is.** A folder with a launcher, the server and the interface inside it.
Nothing is installed. The only thing your machine needs is Node.js 20 or newer
(Node 22.5+ if you want your library to persist — that is the version whose
built-in database the app uses).

**Best for.** Machines where you cannot install software, a USB stick, a server
you prefer not to containerise, or keeping several versions side by side.

**Get it.**

- From the [latest release](https://github.com/timetorepo/researchengine/releases): `research-engine-<version>-win-x64.zip` or `research-engine-<version>-linux-x64.tar.gz`
- Or from this repository: [`downloads/`](../downloads) — the same archives, with their checksums in `SHA256SUMS`

**Check it.**

```bash
cd downloads
sha256sum -c SHA256SUMS
```

**Unpack it.**

Windows — extract the zip, then in that folder:

```bat
research-engine.cmd serve --port 3847
```

Linux:

```bash
tar xzf research-engine-<version>-linux-x64.tar.gz
chmod +x research-engine-linux-x64/research-engine
./research-engine-linux-x64/research-engine serve --port 3847
```

Then open **http://127.0.0.1:3847**.

Optional: put the launcher on your PATH.

```bash
ln -s "$PWD/research-engine-linux-x64/research-engine" ~/.local/bin/research-engine
```

**Useful options.**

```bash
./research-engine serve --port 3847 --profile balanced   # eco | balanced | performance
./research-engine version                                # which build is this, and is it up to date
```

**Run it in the background.**

Linux, as a service — create `/etc/systemd/system/research-engine.service`:

```ini
[Unit]
Description=Research Engine
After=network-online.target

[Service]
User=research
WorkingDirectory=/opt/research-engine
ExecStart=/opt/research-engine/research-engine serve --port 3847 --profile eco
Restart=on-failure
RestartSec=3
Environment=RESEARCH_ENGINE_DATA_DIR=/var/lib/research-engine

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now research-engine
```

Windows, as a service, using [NSSM](https://nssm.cc):

```bat
nssm install ResearchEngine C:\opt\research-engine-win-x64\research-engine.cmd serve --port 3847
nssm start ResearchEngine
```

**Updating a portable copy.** Unpack the new folder next to the old one, stop the
service, point it at the new folder, start it again. Or let the app do it: **Settings → Updates** downloads, verifies and swaps the code for you (your library is never part of that swap, and a version that cannot start is rolled back automatically).

**Uninstalling.** Stop the service, delete the folder, and — only if you want to
lose your work — delete your data folder.

---

## C. Browser (PWA)

**What it is.** The interface is a full web app that can install itself into your
start menu or dock with its own icon and window, and it keeps working when your
connection drops for pages you already have.

**Best for.** A zero-install look around, shared lab machines, or using an
instance someone else runs on your network.

**You need.** A running instance to point at — methods B, D, E or F below — and a
Chromium browser (Chrome, Edge, Brave, Arc) for the full install experience.
Safari can pin it to the Home Screen with reduced background behaviour; Firefox
can pin it as a tab but does not offer full installation. That is a browser
limitation, not a Research Engine one.

**Install it.**

```text
Chrome / Edge :  the install icon in the address bar  →  Install
                 or  menu → Save and share → Install Research Engine
Safari        :  File → Add to Home Screen
```

**Run it.** Launch it from your applications list like any other program.

**Your data** in pure browser mode lives in that browser's profile. Clearing site
data clears it — so for anything you care about, either host the app (methods B,
D, E, F) or keep backups from **Settings → Data**.

**Updating.** Updates ship with the server. The browser refreshes its copy the
next time you open it; **Settings → About** has a *Clear cache & reload* button if
a page ever looks stale.

**Uninstalling.** Right-click the app in your applications list → Uninstall, or
clear the site data for that address.

---

## D. Docker, one container

**What it is.** One small image containing the interface, the server and the
database.

**Best for.** Setups where everything must run in a container, or where you want
hard limits on memory and CPU. Docker is entirely optional — Research Engine runs
lighter without it.

**You need.** Docker 24 or newer.

**Build it.**

```bash
docker build -f Dockerfile.single -t research-engine .
```

**Run it.**

```bash
docker run -d --name research-engine \
  -p 3847:3847 \
  -v re-data:/data \
  -e RE_PROFILE=balanced \
  --memory 512m --cpus 1 \
  research-engine
```

The image runs as a non-root user, answers a health check on `/api/health`, and
keeps everything in `/data`.

**Update it.**

```bash
docker rm -f research-engine
docker build -f Dockerfile.single -t research-engine .
# then run the command above again — the re-data volume keeps your work
```

**Remove it.**

```bash
docker rm -f research-engine
docker rmi research-engine
docker volume rm re-data      # careful: this deletes your library
```

**Limits.** The container uses SQLite inside: perfect for one person or a
household, not a multi-tenant service. No GPU acceleration and no bundled search
service — use method E if you want search to stay on your own network.

---

## E. Docker Compose

**What it is.** The app plus optional extras, such as a private **SearXNG** search
service of your own, so even your searches never leave your network.

**You need.** Docker with the Compose plugin.

**Install.** [`compose.slim.yml`](../compose.slim.yml) ships in the repository:

```bash
docker compose -f compose.slim.yml up --build -d
```

That is the whole installation. It sets `RE_PROFILE`, your optional search keys
and the data volume for you. If you would rather write your own file — for
instance to add a private **SearXNG** so even your searches stay on your network —
this is the commented starting point:

```yaml
services:
  app:
    build: { context: ., dockerfile: Dockerfile.single }
    ports: ["3847:3847"]
    environment:
      RE_PROFILE: balanced                # eco | balanced | performance
      SEARXNG_URL: http://searxng:8080    # used for search when reachable
    volumes:
      - re-data:/data
    deploy:
      resources:
        limits: { memory: 512M, cpus: "1" }
    depends_on: [searxng]

  searxng:
    image: searxng/searxng:latest
    # internal only — no published ports; the app reaches it on the compose network
    volumes:
      - ./searxng:/etc/searxng

volumes:
  re-data:
```

Save that as `compose.advanced.yml`, then:

```bash
docker compose -f compose.advanced.yml up -d
```

**Update it.**

```bash
docker compose -f compose.advanced.yml pull
docker compose -f compose.advanced.yml up -d --build
```

**Remove it.**

```bash
docker compose -f compose.advanced.yml down -v   # -v also deletes the data volume
```

---

## F. Home server or NAS

**What it is.** Install Research Engine once on a machine that is always on, and
open it from any device in the house — phone, tablet, laptop, or an installed
browser app on each.

**Best for.** Synology, Unraid, TrueNAS SCALE, a Raspberry Pi 4/5, an old laptop
running Linux, or any small always-on computer.

**Install.**

- **Synology** — Container Manager → Project → paste the compose file from method E.
- **Unraid** — Docker tab → Add container → image `research-engine`, with a mapped appdata volume.
- **TrueNAS SCALE** — Apps → Custom App → paste the same compose file.
- **Raspberry Pi** — method B is the lightest route; the packaged folder is pure
  JavaScript, so build one for your board with
  `node scripts/package-binary.mjs --target linux-arm64` on the Pi itself (or set
  it running as a systemd service, as in method B).

**Reach it from anywhere, safely.** Publish only a reverse proxy, not the app
itself. With [Caddy](https://caddyserver.com) that is the whole configuration:

```text
research.example.com {
    reverse_proxy localhost:3847
}
```

With nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name research.example.com;
    # ssl_certificate / ssl_certificate_key ...

    location / {
        proxy_pass http://127.0.0.1:3847;
        proxy_buffering off;              # required: answers stream token by token
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_read_timeout 600s;
    }
}
```

**Prefer not to open any port?** Put the machine on
[Tailscale](https://tailscale.com) or WireGuard and point the proxy at its private
address. That is the setup most people here use: nothing public, reachable from
your own devices.

**Updating.** Update the underlying method (new folder or `compose pull`), then
restart the service or container. Your library is untouched.

**Backups.** Copy the data folder (or the `re-data` volume), or use **Settings →
Data** inside the app to produce a versioned ZIP.

---

## G. From source

For developers and anyone who wants to build their own release. See
[development.md](development.md) for the full picture. The short version:

```bash
git clone https://github.com/timetorepo/researchengine.git
cd researchengine
npm install
npm run build
npm start
```

Open **http://127.0.0.1:3847**.

---

## After installing

1. **Onboarding** asks for a theme and motion preference — both skippable, both re-runnable from Settings.
2. **Add an AI provider, or skip.** Settings → Providers takes an API key for any
   provider you use, points at a local model (Ollama, LM Studio), or you can skip
   and explore with the built-in offline model.
3. **Try the parts you will actually use.** Upload a paper to **Read & Quiz**,
   send **Agent Flood** at a topic, or connect Drive, Gmail, Calendar, GitHub,
   Notion or Slack under **Settings → Integrations**.
4. **Keep a backup habit.** Settings → Data makes a ZIP of your whole library.

## Something looks wrong?

- **Which version am I running?** `./research-engine version` in a portable or source install; **Settings → About** anywhere.
- **It feels out of date.** Settings → About says whether the running copy matches what is on disk, and offers *Clear cache & reload*.
- **Toasts and errors.** Settings → Developer adds a build fingerprint to the top bar and a test bench that exercises the real code path and hands you a copyable report.
- **More help:** [development.md](development.md) has the troubleshooting list, and issues are welcome at [github.com/timetorepo/researchengine/issues](https://github.com/timetorepo/researchengine/issues).
