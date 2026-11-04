/**
 * Every framework the agent can work in, and the two things that make that
 * true: the command that creates a project, and — where a project is small
 * enough to be a handful of real files — the files themselves.
 *
 * "Support" here is not a logo wall. An entry either knows how to scaffold a
 * working project (and the app creates it in one click, into the same projects
 * folder everything else lives in), or it names the official create command the
 * agent will run in its own terminal, with the note that says what has to be on
 * the machine first. A scaffold that does not run would be worse than none.
 */
import type { Manager } from '@/lib/design/providers'

export interface Framework {
  id: string
  name: string
  kind: 'web' | 'mobile' | 'backend' | 'tool'
  /** What the agent can do with it, in one line. */
  note: string
  /** Files that mean "this project is this framework". */
  detect: string[]
  /** The official create command, when the toolchain makes the files. */
  create?: string
  install?: (m: Manager) => string
  dev?: string
  build?: string
  test?: string
  /** The toolchain that has to exist for the commands above. */
  requires?: string
  docs: string
  /** Real starter files, given the project name. Only where they are known to work. */
  scaffold?: (name: string) => Record<string, string>
}

const pkg = (name: string, deps: Record<string, string>, scripts: Record<string, string>, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ name, private: true, version: '0.1.0', type: 'module', scripts, dependencies: deps, ...extra }, null, 2) + '\n'

export const FRAMEWORKS: Framework[] = [
  {
    id: 'react-vite', name: 'React (Vite)', kind: 'web',
    note: 'Components, hooks, client routing — the default the app itself is written in.',
    detect: ['src/main.tsx', 'src/main.jsx', 'src/main.js'],
    install: (m) => (m === 'npm' ? 'npm install' : `${m} install`),
    dev: 'npm run dev', build: 'npm run build', test: 'npm test',
    requires: 'Node 18+',
    docs: 'https://react.dev',
    scaffold: (n) => ({
      'package.json': pkg(n, { react: '^18.3.1', 'react-dom': '^18.3.1' }, { dev: 'vite', build: 'vite build', preview: 'vite preview' }, { devDependencies: { '@vitejs/plugin-react': '^4.3.1', typescript: '^5.6.2', vite: '^5.4.8' } }),
      'index.html': '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>' + n + '</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n',
      'src/main.tsx': "import React from 'react'\nimport { createRoot } from 'react-dom/client'\nimport App from './App'\nimport './styles.css'\n\ncreateRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)\n",
      'src/App.tsx': 'export default function App() {\n  return (\n    <main className="page">\n      <h1>' + n + '</h1>\n      <p>Start building here.</p>\n    </main>\n  )\n}\n',
      'src/styles.css': ':root { color-scheme: light dark; }\nbody { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; }\n.page { max-width: 40rem; margin: 4rem auto; padding: 0 1.5rem; }\n',
      'README.md': '# ' + n + '\n\nA React project created in Research Engine with Vite.\n\n```bash\nnpm install\nnpm run dev\n```\n',
    }),
  },
  {
    id: 'next', name: 'Next.js', kind: 'web',
    note: 'Routing, server components, API routes and deployment in one toolchain.',
    detect: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    create: 'npx create-next-app@latest',
    dev: 'npm run dev', build: 'npm run build', test: 'npm test',
    requires: 'Node 18+',
    docs: 'https://nextjs.org/docs',
  },
  {
    id: 'vue', name: 'Vue', kind: 'web',
    note: 'Single-file components and reactivity without ceremony.',
    detect: ['src/App.vue'],
    create: 'npm create vue@latest',
    dev: 'npm run dev', build: 'npm run build', test: 'npm test',
    requires: 'Node 18+',
    docs: 'https://vuejs.org',
  },
  {
    id: 'nuxt', name: 'Nuxt', kind: 'web',
    note: 'Vue with file routing, SSR and a server layer.',
    detect: ['nuxt.config.ts'],
    create: 'npx nuxi@latest init',
    dev: 'npm run dev', build: 'npm run build',
    requires: 'Node 18+',
    docs: 'https://nuxt.com/docs',
  },
  {
    id: 'sveltekit', name: 'SvelteKit', kind: 'web',
    note: 'Svelte with routing, SSR and adapters for every host.',
    detect: ['svelte.config.js'],
    create: 'npx sv create',
    dev: 'npm run dev', build: 'npm run build', test: 'npm test',
    requires: 'Node 18+',
    docs: 'https://svelte.dev/docs/kit',
  },
  {
    id: 'astro', name: 'Astro', kind: 'web',
    note: 'Content-first sites that ship almost no JavaScript.',
    detect: ['astro.config.mjs'],
    create: 'npm create astro@latest',
    dev: 'npm run dev', build: 'npm run build',
    requires: 'Node 18+',
    docs: 'https://docs.astro.build',
  },
  {
    id: 'angular', name: 'Angular', kind: 'web',
    note: 'Opinionated, batteries-included, TypeScript throughout.',
    detect: ['angular.json'],
    create: 'npx @angular/cli@latest new',
    dev: 'npm start', build: 'npm run build', test: 'npm test',
    requires: 'Node 18+',
    docs: 'https://angular.dev',
  },
  {
    id: 'solid', name: 'Solid', kind: 'web',
    note: 'Fine-grained reactivity without a virtual DOM.',
    detect: ['src/index.tsx', 'src/entry-client.tsx'],
    create: 'npx degit solidjs/templates/ts',
    dev: 'npm run dev', build: 'npm run build',
    requires: 'Node 18+',
    docs: 'https://www.solidjs.com/docs',
  },
  {
    id: 'qwik', name: 'Qwik', kind: 'web',
    note: 'Resumable apps that start instantly.',
    detect: ['qwik.config.ts', 'src/root.tsx'],
    create: 'npm create qwik@latest',
    dev: 'npm run dev', build: 'npm run build',
    requires: 'Node 18+',
    docs: 'https://qwik.dev/docs',
  },
  {
    id: 'react-native', name: 'React Native', kind: 'mobile',
    note: 'Native iOS and Android from React, with the app running on the device.',
    detect: ['metro.config.js', 'android/app/build.gradle'],
    create: 'npx @react-native-community/cli@latest init',
    dev: 'npm run android', build: 'npm run ios', test: 'npm test',
    requires: 'Node 18+, Android Studio or Xcode',
    docs: 'https://reactnative.dev/docs/getting-started',
  },
  {
    id: 'expo', name: 'Expo', kind: 'mobile',
    note: 'React Native with a managed toolchain and over-the-air updates.',
    detect: ['app.json', 'expo-env.d.ts'],
    create: 'npx create-expo-app@latest',
    dev: 'npx expo start', test: 'npm test',
    requires: 'Node 18+, Expo Go on the device',
    docs: 'https://docs.expo.dev',
  },
  {
    id: 'flutter', name: 'Flutter', kind: 'mobile',
    note: 'One Dart codebase compiling to real iOS and Android apps, 120 fps capable.',
    detect: ['pubspec.yaml'],
    create: 'flutter create',
    dev: 'flutter run', build: 'flutter build apk', test: 'flutter test',
    requires: 'Flutter SDK',
    docs: 'https://docs.flutter.dev',
  },
  {
    id: 'swift', name: 'Swift / SwiftUI', kind: 'mobile',
    note: 'Native Apple platforms — iOS, iPadOS, macOS, watchOS.',
    detect: ['Package.swift', '*.xcodeproj'],
    create: 'swift package init --type executable',
    dev: 'swift run', build: 'swift build', test: 'swift test',
    requires: 'Xcode (macOS)',
    docs: 'https://developer.apple.com/documentation/swiftui',
  },
  {
    id: 'kotlin', name: 'Kotlin / Android', kind: 'mobile',
    note: 'Native Android with Jetpack Compose.',
    detect: ['build.gradle.kts', 'settings.gradle.kts'],
    create: 'gradle init',
    dev: './gradlew installDebug', build: './gradlew assembleDebug', test: './gradlew test',
    requires: 'JDK 17+, Android SDK',
    docs: 'https://developer.android.com/develop',
  },
  {
    id: 'java-maven', name: 'Java (Maven)', kind: 'backend',
    note: 'Plain Java with the standard build tool.',
    detect: ['pom.xml'],
    dev: 'mvn exec:java', build: 'mvn package', test: 'mvn test',
    requires: 'JDK 17+, Maven',
    docs: 'https://maven.apache.org/guides/',
    scaffold: (n) => ({
      'pom.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">\n  <modelVersion>4.0.0</modelVersion>\n  <groupId>app</groupId>\n  <artifactId>' + n.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() + '</artifactId>\n  <version>0.1.0</version>\n  <properties>\n    <maven.compiler.release>17</maven.compiler.release>\n    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>\n  </properties>\n</project>\n',
      'src/main/java/app/Main.java': 'package app;\n\npublic final class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from ' + n + '");\n  }\n}\n',
      'README.md': '# ' + n + '\n\nA Java project created in Research Engine.\n\n```bash\nmvn package\nmvn exec:java\n```\n',
    }),
  },
  {
    id: 'java-gradle', name: 'Java / Kotlin (Gradle)', kind: 'backend',
    note: 'Gradle builds for JVM services and Android.',
    detect: ['build.gradle', 'settings.gradle'],
    create: 'gradle init',
    dev: './gradlew run', build: './gradlew build', test: './gradlew test',
    requires: 'JDK 17+',
    docs: 'https://docs.gradle.org/current/userguide/userguide.html',
  },
  {
    id: 'spring-boot', name: 'Spring Boot', kind: 'backend',
    note: 'Java HTTP services and APIs.',
    detect: ['src/main/resources/application.properties', 'src/main/resources/application.yml'],
    create: 'curl https://start.spring.io/starter.zip -o app.zip',
    dev: './mvnw spring-boot:run', build: './mvnw package', test: './mvnw test',
    requires: 'JDK 17+, Maven or Gradle',
    docs: 'https://spring.io/guides',
  },
  {
    id: 'dotnet', name: '.NET', kind: 'backend',
    note: 'C# services, APIs and desktop apps.',
    detect: ['*.csproj', '*.sln'],
    create: 'dotnet new webapi -o .',
    dev: 'dotnet run', build: 'dotnet build', test: 'dotnet test',
    requires: '.NET SDK 8+',
    docs: 'https://learn.microsoft.com/dotnet/',
  },
  {
    id: 'go', name: 'Go', kind: 'backend',
    note: 'Small binaries, a real standard library, fast builds.',
    detect: ['go.mod'],
    dev: 'go run .', build: 'go build ./...', test: 'go test ./...',
    requires: 'Go 1.22+',
    docs: 'https://go.dev/doc/',
    scaffold: (n) => ({
      'go.mod': 'module ' + n.replace(/[^a-z0-9-]/gi, '-').toLowerCase() + '\n\ngo 1.22\n',
      'main.go': 'package main\n\nimport (\n\t"fmt"\n\t"net/http"\n)\n\nfunc main() {\n\thttp.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {\n\t\tfmt.Fprintln(w, "Hello from ' + n + '")\n\t})\n\thttp.ListenAndServe(":8080", nil)\n}\n',
      'README.md': '# ' + n + '\n\nA Go project created in Research Engine.\n\n```bash\ngo run .\n```\n',
    }),
  },
  {
    id: 'rust', name: 'Rust', kind: 'backend',
    note: 'Systems-level code with a compiler that catches mistakes early.',
    detect: ['Cargo.toml'],
    dev: 'cargo run', build: 'cargo build --release', test: 'cargo test',
    requires: 'Rust toolchain',
    docs: 'https://doc.rust-lang.org/book/',
    scaffold: (n) => ({
      'Cargo.toml': '[package]\nname = "' + n.replace(/[^a-z0-9-]/gi, '-').toLowerCase() + '"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n',
      'src/main.rs': 'fn main() {\n    println!("Hello from ' + n + '");\n}\n',
      'README.md': '# ' + n + '\n\nA Rust project created in Research Engine.\n\n```bash\ncargo run\n```\n',
    }),
  },
  {
    id: 'python', name: 'Python', kind: 'backend',
    note: 'Scripts, data work, services.',
    detect: ['pyproject.toml', 'requirements.txt'],
    dev: 'python -m app', build: 'python -m build', test: 'pytest',
    requires: 'Python 3.11+',
    docs: 'https://docs.python.org/3/',
    scaffold: (n) => ({
      'main.py': 'def main() -> None:\n    print("Hello from ' + n + '")\n\n\nif __name__ == "__main__":\n    main()\n',
      'requirements.txt': '# add dependencies here, one per line\n',
      'README.md': '# ' + n + '\n\nA Python project created in Research Engine.\n\n```bash\npython main.py\n```\n',
    }),
  },
  {
    id: 'fastapi', name: 'FastAPI', kind: 'backend',
    note: 'Typed Python HTTP APIs with automatic docs.',
    detect: ['app/main.py'],
    create: 'pip install "fastapi[standard]"',
    dev: 'fastapi dev', test: 'pytest',
    requires: 'Python 3.9+',
    docs: 'https://fastapi.tiangolo.com',
  },
  {
    id: 'django', name: 'Django', kind: 'backend',
    note: 'Python web apps with an admin, ORM and migrations.',
    detect: ['manage.py'],
    create: 'django-admin startproject',
    dev: 'python manage.py runserver', test: 'python manage.py test',
    requires: 'Python 3.10+',
    docs: 'https://docs.djangoproject.com',
  },
  {
    id: 'rails', name: 'Ruby on Rails', kind: 'backend',
    note: 'Convention-driven Ruby web apps.',
    detect: ['Gemfile', 'config/routes.rb'],
    create: 'rails new',
    dev: 'bin/rails server', test: 'bin/rails test',
    requires: 'Ruby 3.2+',
    docs: 'https://guides.rubyonrails.org',
  },
  {
    id: 'laravel', name: 'Laravel', kind: 'backend',
    note: 'PHP web apps with queues, migrations and Blade.',
    detect: ['artisan'],
    create: 'composer create-project laravel/laravel',
    dev: 'php artisan serve', test: 'php artisan test',
    requires: 'PHP 8.2+, Composer',
    docs: 'https://laravel.com/docs',
  },
  {
    id: 'phoenix', name: 'Elixir / Phoenix', kind: 'backend',
    note: 'Realtime apps on the BEAM — websockets and channels come first.',
    detect: ['mix.exs'],
    create: 'mix phx.new',
    dev: 'mix phx.server', test: 'mix test',
    requires: 'Elixir, Erlang, PostgreSQL',
    docs: 'https://hexdocs.pm/phoenix',
  },
  {
    id: 'tauri', name: 'Tauri', kind: 'tool',
    note: 'Desktop apps with a web frontend and a Rust core — what this app is.',
    detect: ['src-tauri/tauri.conf.json'],
    create: 'npm create tauri-app@latest',
    dev: 'npm run tauri dev', build: 'npm run tauri build',
    requires: 'Rust toolchain, platform webview',
    docs: 'https://v2.tauri.app/start/',
  },
]

export const frameworkById = (id: string): Framework | undefined => FRAMEWORKS.find((f) => f.id === id)

const matchCount = (framework: Framework, paths: string[]): number =>
  framework.detect.filter((d) => {
    if (d.startsWith('*')) {
      const ext = d.slice(1)
      return paths.some((p) => p.endsWith(ext))
    }
    return paths.some((p) => p === d || p.endsWith('/' + d))
  }).length

/**
 * Which frameworks a project's file list says it is, most signals first.
 * Detection is a heuristic on filenames — it is used to pick the run command
 * and to tell the user what the agent thinks it is working in, never to refuse
 * a command.
 */
export function detectFrameworks(paths: string[]): Framework[] {
  return FRAMEWORKS
    .map((f, i) => ({ f, score: matchCount(f, paths), i }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.f)
}

/** The best match — what the run button should use. */
export const detectFramework = (paths: string[]): Framework | undefined => detectFrameworks(paths)[0]

export const KIND_LABEL: Record<Framework['kind'], string> = {
  web: 'Web', mobile: 'Mobile', backend: 'Backend', tool: 'Desktop',
}
