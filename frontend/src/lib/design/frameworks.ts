/**
 * Every framework the coding agent can work in.
 *
 * "Access to all the frameworks" is a promise that has to be mechanical: for
 * each one, how you know a project is using it (marker files), and the commands
 * that install, run, test and build it. The agent reads this table instead of
 * guessing, and the Coding view uses it to label an open project.
 *
 * Versions of the commands are deliberately the boring, canonical ones — the
 * agent can adapt, but the default must be a line that runs.
 */

export interface Framework {
  id: string
  name: string
  language: string
  /** One line, for the picker. */
  what: string
  /** Files or package.json keys that identify the project. */
  detect: RegExp[]
  install: string
  dev: string
  test: string
  build: string
  /** Where the build lands — used by the deploy configs. */
  outDir: string
  docs: string
}

export const FRAMEWORKS: Framework[] = [
  {
    id: 'react-vite', name: 'React + Vite', language: 'TypeScript', what: 'A single-page React app.',
    detect: [/vite\.config\.(ts|js|mts|mjs)$/i, /"vite"\s*:/], install: 'npm install', dev: 'npm run dev', test: 'npm test', build: 'npm run build', outDir: 'dist',
    docs: 'https://vite.dev',
  },
  {
    id: 'next', name: 'Next.js', language: 'TypeScript', what: 'A React framework with routing and server rendering.',
    detect: [/next\.config\.(js|mjs|ts)$/i, /"next"\s*:/], install: 'npm install', dev: 'npm run dev', test: 'npm test', build: 'npm run build', outDir: '.next',
    docs: 'https://nextjs.org/docs',
  },
  {
    id: 'remix', name: 'Remix / React Router', language: 'TypeScript', what: 'Data-driven React with nested routes.',
    detect: [/remix\.config\.(js|ts)$/i, /"@remix-run\//, /react-router\.config\.(ts|js)$/i], install: 'npm install', dev: 'npm run dev', test: 'npm test', build: 'npm run build', outDir: 'build',
    docs: 'https://remix.run/docs',
  },
  {
    id: 'vue', name: 'Vue 3', language: 'TypeScript', what: 'A progressive framework, single-file components.',
    detect: [/vue\.config\.(js|ts)$/i, /"vue"\s*:/], install: 'npm install', dev: 'npm run dev', test: 'npm run test', build: 'npm run build', outDir: 'dist',
    docs: 'https://vuejs.org',
  },
  {
    id: 'nuxt', name: 'Nuxt', language: 'TypeScript', what: 'The Vue meta-framework.',
    detect: [/nuxt\.config\.(ts|js)$/i], install: 'npm install', dev: 'npm run dev', test: 'npm run test', build: 'npm run build', outDir: '.output',
    docs: 'https://nuxt.com/docs',
  },
  {
    id: 'sveltekit', name: 'SvelteKit', language: 'TypeScript', what: 'Svelte with routing and SSR.',
    detect: [/svelte\.config\.(js|ts)$/i], install: 'npm install', dev: 'npm run dev', test: 'npm run test', build: 'npm run build', outDir: 'build',
    docs: 'https://svelte.dev/docs/kit',
  },
  {
    id: 'angular', name: 'Angular', language: 'TypeScript', what: 'The batteries-included framework.',
    detect: [/angular\.json$/i], install: 'npm install', dev: 'npm start', test: 'npm test', build: 'npm run build', outDir: 'dist',
    docs: 'https://angular.dev',
  },
  {
    id: 'solid', name: 'SolidJS', language: 'TypeScript', what: 'Fine-grained reactivity without a virtual DOM.',
    detect: [/"solid-js"\s*:/], install: 'npm install', dev: 'npm run dev', test: 'npm test', build: 'npm run build', outDir: 'dist',
    docs: 'https://docs.solidjs.com',
  },
  {
    id: 'astro', name: 'Astro', language: 'TypeScript', what: 'Content-first sites that ship almost no JavaScript.',
    detect: [/astro\.config\.(mjs|ts|js)$/i], install: 'npm install', dev: 'npm run dev', test: 'npm test', build: 'npm run build', outDir: 'dist',
    docs: 'https://docs.astro.build',
  },
  {
    id: 'react-native', name: 'React Native', language: 'TypeScript', what: 'Native iOS and Android from React.',
    detect: [/react-native\.config\.(js|ts)$/i, /"react-native"\s*:/], install: 'npm install', dev: 'npx react-native start', test: 'npm test', build: 'npx react-native run-android', outDir: 'android/app/build',
    docs: 'https://reactnative.dev/docs/getting-started',
  },
  {
    id: 'expo', name: 'Expo', language: 'TypeScript', what: 'React Native with the tooling solved.',
    detect: [/app\.json$/i, /app\.config\.(js|ts)$/i, /"expo"\s*:/], install: 'npm install', dev: 'npx expo start', test: 'npm test', build: 'npx expo run:android', outDir: 'dist',
    docs: 'https://docs.expo.dev',
  },
  {
    id: 'flutter', name: 'Flutter', language: 'Dart', what: 'One codebase for iOS, Android, web and desktop.',
    detect: [/pubspec\.yaml$/i], install: 'flutter pub get', dev: 'flutter run', test: 'flutter test', build: 'flutter build apk', outDir: 'build',
    docs: 'https://docs.flutter.dev',
  },
  {
    id: 'java-maven', name: 'Java · Maven', language: 'Java', what: 'The classic JVM build.',
    detect: [/pom\.xml$/i], install: 'mvn install', dev: 'mvn spring-boot:run', test: 'mvn test', build: 'mvn package', outDir: 'target',
    docs: 'https://maven.apache.org/guides/',
  },
  {
    id: 'java-gradle', name: 'Java · Gradle', language: 'Java or Kotlin', what: 'The modern JVM build.',
    detect: [/build\.gradle(\.kts)?$/i, /gradlew$/i], install: './gradlew build', dev: './gradlew bootRun', test: './gradlew test', build: './gradlew build', outDir: 'build/libs',
    docs: 'https://docs.gradle.org',
  },
  {
    id: 'kotlin', name: 'Kotlin / Android', language: 'Kotlin', what: 'Android apps and Kotlin services.',
    detect: [/settings\.gradle\.kts$/i, /AndroidManifest\.xml$/i], install: './gradlew build', dev: './gradlew installDebug', test: './gradlew test', build: './gradlew assembleRelease', outDir: 'app/build/outputs',
    docs: 'https://kotlinlang.org/docs/home.html',
  },
  {
    id: 'swift', name: 'Swift / SwiftUI', language: 'Swift', what: 'Apple platforms.',
    detect: [/Package\.swift$/i, /\.xcodeproj$/i], install: 'swift package resolve', dev: 'swift run', test: 'swift test', build: 'swift build -c release', outDir: '.build',
    docs: 'https://swift.org/documentation/',
  },
  {
    id: 'dotnet', name: '.NET / C#', language: 'C#', what: 'Web APIs, desktop and games.',
    detect: [/\.csproj$/i, /\.sln$/i], install: 'dotnet restore', dev: 'dotnet watch run', test: 'dotnet test', build: 'dotnet build -c Release', outDir: 'bin/Release',
    docs: 'https://learn.microsoft.com/dotnet',
  },
  {
    id: 'go', name: 'Go', language: 'Go', what: 'Small binaries, fast servers.',
    detect: [/go\.mod$/i], install: 'go mod download', dev: 'go run .', test: 'go test ./...', build: 'go build ./...', outDir: '.',
    docs: 'https://go.dev/doc/',
  },
  {
    id: 'rust', name: 'Rust', language: 'Rust', what: 'Systems and CLIs, with Cargo.',
    detect: [/Cargo\.toml$/i], install: 'cargo fetch', dev: 'cargo run', test: 'cargo test', build: 'cargo build --release', outDir: 'target/release',
    docs: 'https://doc.rust-lang.org/book/',
  },
  {
    id: 'python', name: 'Python', language: 'Python', what: 'Scripts, data, FastAPI and Django services.',
    detect: [/requirements\.txt$/i, /pyproject\.toml$/i, /manage\.py$/i], install: 'python -m pip install -r requirements.txt', dev: 'python -m uvicorn main:app --reload', test: 'python -m pytest', build: 'python -m build', outDir: 'dist',
    docs: 'https://docs.python.org/3/',
  },
  {
    id: 'django', name: 'Django', language: 'Python', what: 'The batteries-included Python web framework.',
    detect: [/manage\.py$/i], install: 'pip install -r requirements.txt', dev: 'python manage.py runserver', test: 'python manage.py test', build: 'python manage.py collectstatic --noinput', outDir: 'staticfiles',
    docs: 'https://docs.djangoproject.com',
  },
  {
    id: 'php-laravel', name: 'PHP · Laravel', language: 'PHP', what: 'PHP web apps.',
    detect: [/artisan$/i, /composer\.json$/i], install: 'composer install', dev: 'php artisan serve', test: 'php artisan test', build: 'npm run build', outDir: 'public/build',
    docs: 'https://laravel.com/docs',
  },
  {
    id: 'rails', name: 'Ruby on Rails', language: 'Ruby', what: 'Convention-driven web apps.',
    detect: [/Gemfile$/i, /config\/routes\.rb$/i], install: 'bundle install', dev: 'bin/rails server', test: 'bin/rails test', build: 'bin/rails assets:precompile', outDir: 'public/assets',
    docs: 'https://guides.rubyonrails.org',
  },
  {
    id: 'phoenix', name: 'Elixir · Phoenix', language: 'Elixir', what: 'Real-time web on the BEAM.',
    detect: [/mix\.exs$/i], install: 'mix deps.get', dev: 'mix phx.server', test: 'mix test', build: 'mix release', outDir: '_build',
    docs: 'https://hexdocs.pm/phoenix',
  },
]

export const frameworkById = (id: string) => FRAMEWORKS.find((f) => f.id === id) ?? null

/**
 * Which framework is this project? Matched against the file names in the
 * project tree (and package.json contents where the caller has them). Returns
 * the first match in table order, which puts the more specific framework before
 * the generic one (Next.js before React).
 */
export function detectFramework(files: string[]): Framework | null {
  const names = files.map((f) => f.split('/').pop() ?? f)
  for (const fw of FRAMEWORKS) {
    if (fw.detect.some((re) => names.some((n) => re.test(n)))) return fw
  }
  return null
}
